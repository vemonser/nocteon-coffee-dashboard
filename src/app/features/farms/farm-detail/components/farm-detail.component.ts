import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { map, switchMap, catchError, of, tap } from 'rxjs';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft, lucidePencil, lucideTrash2, lucideImage, lucidePackage,
  lucideTag, lucideCheck, lucideX, lucideLoader2, lucideRotateCcw,
  lucideAlertCircle, lucideUpload, lucideMapPin, lucidePlus,
} from '@ng-icons/lucide';
import { FarmService } from '../../services/farm.service';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';
import {
  FarmRequest, FarmTranslation, DashboardFarmResponse, ProductCardResponse,
} from '../../models/farm.model';
import { PageResponse } from '../../../../core/models/api-response.model';
import { NotifyService } from '../../../../core/notify/notify.service';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';

import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../../../core/i18n/language.service';
import { StoreSettingsService } from '../../../../core/settings/store-settings.service';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../../core/auth/permission.directive';
import { createColumnHelper, ColumnDef } from '@tanstack/angular-table';
import { formatCurrency, formatPercent } from '../../../../shared/utils/locale-format';

type EditMode = 'view' | 'edit';

@Component({
  selector: 'app-farm-detail',
  standalone: true,
  imports: [
    RouterModule,
    PagerComponent,
    CommonModule, FormsModule, ReactiveFormsModule,
    HlmCardImports, HlmButtonImports, HlmBadgeImports,
    HlmSeparatorImports, HlmInputImports, HlmLabelImports, NgIcon,
    TranslocoPipe, DataTableComponent, HasPermissionDirective,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft, lucidePencil, lucideTrash2, lucideImage, lucidePackage,
      lucideTag, lucideCheck, lucideX, lucideLoader2, lucideRotateCcw,
      lucideAlertCircle, lucideUpload, lucideMapPin, lucidePlus,
    }),
  ],
  templateUrl: './farm-detail.component.html',
})
export class FarmDetailComponent implements OnInit {
  private notify = inject(NotifyService);
  private confirmDialog = inject(ConfirmDialogService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private farmService = inject(FarmService);
  private breadcrumbService = inject(BreadcrumbService);
  protected translationHelper = inject(TranslationFormHelper);
  protected language = inject(LanguageService);
  private readonly storeSettings = inject(StoreSettingsService);

  protected readonly Math = Math;

  readonly farm = signal<DashboardFarmResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<EditMode>('view');

  // Products state — shared DataTable pattern
  readonly products = signal<ProductCardResponse[]>([]);
  readonly productsLoading = signal(false);
  readonly productsPage = signal<PageResponse<ProductCardResponse> | null>(null);
  readonly currentProductPage = signal(0);
  readonly productsError = signal(false);

  // Per-page selector — mirrors BaseListComponent convention (10/20/50, default 20)
  readonly productPageSize = signal(20);
  readonly productPageSizeOptions = [10, 20, 50] as const;

  form!: FormGroup;

  readonly isEditing = computed(() => this.mode() === 'edit');
  readonly isDirty = signal(false);

  /** Column definitions for the embedded products list (shared DataTable). */
  private productColumnHelper = createColumnHelper<ProductCardResponse>();

  readonly columns = computed<ColumnDef<ProductCardResponse, any>[]>(() => {
    const lang = this.language.language();
    const items = this.products();
    const helper = this.productColumnHelper;

    const entityCell = helper.accessor(
      (row) => ({ name: row.name, slug: row.slug, imageUrl: row.primaryImageUrl, otherName: '—' }),
      {
        id: `main_${lang}`,
        // English-only literals: the shared table maps them through HEADER_KEYS
        // and renders the transloco key, so both languages get the translated header.
        header: 'Name',
        enableSorting: false,
      },
    );

    const priceCell = helper.accessor(
      (row): string => {
        const min = Number(row.minPrice || 0);
        const max = Number(row.maxPrice || 0);
        if (min === max) return this.fmtPrice(min);
        return `${this.fmtPrice(min)} - ${this.fmtPrice(max)}`;
      },
      {
        id: 'price',
        header: 'Price',
        enableSorting: false,
      },
    );

    const discountCell = helper.accessor(
      (row): string => (Number(row.discountPercentage) > 0 ? this.fmtPct(row.discountPercentage) : '—'),
      {
        id: 'discount',
        header: 'Discount',
        enableSorting: false,
      },
    );

    const statusCell = helper.accessor('isActive', {
      header: 'Status',
      enableSorting: false,
    });

    const typeCell = helper.accessor('productType', {
      id: 'type',
      header: 'Type',
      enableSorting: false,
    });

    const featuredCell = helper.accessor('featured', {
      id: 'featured',
      header: 'Featured',
      enableSorting: false,
    });

    const showType = new Set(items.map((p) => p.productType).filter((t): t is string => !!t)).size > 1;
    const showFeatured = items.some((p) => p.featured);

    return [
      entityCell,
      priceCell,
      discountCell,
      statusCell,
      ...(showType ? [typeCell] : []),
      ...(showFeatured ? [featuredCell] : []),
    ];
  });

  readonly isNew = signal(false);

  // Language change → refetch products at the current page with the new locale.
  private readonly languageEffect = effect(() => {
    this.language.language();
    const farm = this.farm();
    if (farm?.slug) {
      this.loadProducts(farm.slug, this.currentProductPage());
    }
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug')),
        switchMap((slug) => {
          if (slug === 'new') {
            this.isNew.set(true);
            this.loading.set(false);
            this.buildEmptyForm();
            return of(null);
          }
          if (!slug) {
            this.error.set('Farm not found');
            return of(null);
          }
          this.loading.set(true);
          return this.farmService.getDashboardBySlug(slug).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load farm');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          this.farm.set(res.data);
          this.buildForm(res.data);
          this.loadProducts(res.data.slug, 0);

          const displayName = this.getTranslationName('en') || res.data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
        }
      });
  }

  private buildEmptyForm(): void {
    this.form = this.fb.group({
      originSlug: [''],
      translations: this.translationHelper.buildArray([], ['description', 'country']),
    });
    this._updateTranslationsArray();
    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => {
      this.isDirty.set(this.form.dirty);
    });
  }

  private buildForm(data: DashboardFarmResponse): void {
    this.form = this.fb.group({
      originSlug: [data.originSlug],
      translations: this.translationHelper.buildArray(data.translations, ['description', 'country']),
    });
    this._updateTranslationsArray();
    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => {
      this.isDirty.set(this.form.dirty);
    });
  }

  private loadProducts(slug: string, page: number): void {
    const size = this.productPageSize();
    // This method owns the page state: every caller (route param change, pager,
    // per-page change, language refetch) goes through here, so `currentProductPage`
    // can never drift from what was actually requested.
    this.currentProductPage.set(page);
    this.productsLoading.set(true);
    this.productsError.set(false);
    this.farmService
      .getProducts(slug, { page, size })
      .pipe(
        catchError((err) => {
          this.productsError.set(true);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not load products');
          return of({
            data: { content: [], totalElements: 0, totalPages: 0, page, size, first: true, last: true },
          } as any);
        }),
      )
      .subscribe((res) => {
        this.productsLoading.set(false);
        this.products.set(res.data.content);
        this.productsPage.set(res.data);
      });
  }

  goToProductPage(page: number): void {
    const slug = this.farm()?.slug;
    if (!slug) return;
    this.currentProductPage.set(page);
    this.loadProducts(slug, page);
  }

  /** Per-page change from the embedded pager: back to page 0, refetch with new size. */
  onProductPageSizeChange(size: number): void {
    if (size === this.productPageSize()) return;
    this.productPageSize.set(size);
    this.currentProductPage.set(0);
    const slug = this.farm()?.slug;
    if (!slug) return;
    this.loadProducts(slug, 0);
  }

  /** Retry the failed products fetch (the error state's action). */
  retryProducts(): void {
    const slug = this.farm()?.slug;
    if (!slug) return;
    this.loadProducts(slug, this.currentProductPage());
  }

  startEdit(): void {
    this.mode.set('edit');
  }

  cancelEdit(): void {
    const data = this.farm();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;

    const slug = this.farm()?.slug;

    this.saving.set(true);

    const req: FarmRequest = {
      originSlug: this.form.value.originSlug,
      translations: this.form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        country: t.country || undefined,
        description: t.description || undefined,
      })),
    };

    const save$ = this.isNew()
      ? this.farmService.create(req, undefined, 'multipart')
      : this.farmService.update(slug!, req);

    save$
      .pipe(
        tap(() => this.saving.set(false)),
        catchError((err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Failed to save');
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res?.data) {
          const data = res.data;
          this.farm.set(data);
          this.isNew.set(false);
          this.mode.set('view');
          this.form.markAsPristine();

          const displayName = this.getTranslationName('en') || data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
          this.router.navigate(['/dashboard/farms', data.slug]);
        }
      });
  }

async deleteFarm(): Promise<void> {
    const name = this.getTranslationName('en');
    if (!(await this.confirmDialog.confirm({ title: 'Delete', message: `Delete "${name}"? This cannot be undone.`, tone: 'destructive' }))) return;

    const slug = this.farm()?.slug;
    if (!slug) return;

    this.farmService.delete(slug).subscribe({
      next: () => this.router.navigate(['/dashboard/farms']),
      error: (err) => this.error.set(err?.error?.message || 'Failed to delete'),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/farms']);
  }

  getTranslationName(lang: string): string {
    return this.farm()?.translations.find((t) => t.language === lang)?.name || '';
  }

  getTranslationCountry(lang: string): string {
    return (this.farm()?.translations.find((t) => t.language === lang) as FarmTranslation)?.country || '';
  }

  protected readonly translationsArray = signal<FormArray<FormGroup> | null>(null);

  private _updateTranslationsArray(): void {
    const ctrl = this.form?.get('translations');
    if (ctrl instanceof FormArray) {
      this.translationsArray.set(ctrl);
    }
  }

  /** The product NAME is the row's way into the product (a real anchor).
   *  Products have no detail page — the wizard is also the editor — so the
   *  link goes to `/dashboard/products/{slug}/edit`, the same target the
   *  products list's Edit action uses. The slug below the name stays plain
   *  text: one clickable control per row — same principle as the catalog lists.
   */
  readonly productHref = (row: ProductCardResponse): any[] | null =>
    row?.slug ? ['/dashboard/products', row.slug, 'edit'] : null;

  fmtPrice(value: number): string {
    return formatCurrency(value, this.language.language(), this.storeSettings.currency());
  }

  fmtPct(value: number | string): string {
    return formatPercent(value, this.language.language());
  }
}