import { Component, inject, OnInit, signal, computed, effect, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterModule } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { map, switchMap, catchError, of, tap } from 'rxjs';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { LocalizedDateComponent } from '../../../../shared/ui/localized-date/localized-date.component';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft, lucidePencil, lucideTrash2, lucideImage, lucidePackage,
  lucideTag, lucideCheck, lucideX, lucideLoader2, lucideRotateCcw,
  lucideAlertCircle, lucideUpload, lucidePlus,
} from '@ng-icons/lucide';
import { OriginService } from '../../services/origin.service';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';

import { PageResponse } from '../../../../core/models/api-response.model';
import { NotifyService } from '../../../../core/notify/notify.service';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';
import { DashboardOriginResponse, OriginRequest, ProductCardResponse } from '../../models/origin.model';

import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../../../core/i18n/language.service';
import { StoreSettingsService } from '../../../../core/settings/store-settings.service';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { TrashBannerComponent } from '../../../../shared/components/trash-banner/trash-banner.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../../core/auth/permission.directive';
import { createColumnHelper, ColumnDef } from '@tanstack/angular-table';
import { formatCurrency, formatPercent } from '../../../../shared/utils/locale-format';

type EditMode = 'view' | 'edit';

@Component({
  selector: 'app-origin-detail',
  standalone: true,
  imports: [
    RouterLink,
    RouterModule,
    PagerComponent,
    CommonModule, FormsModule, ReactiveFormsModule,
    HlmCardImports, HlmButtonImports, HlmBadgeImports,
    HlmSeparatorImports, HlmInputImports, HlmLabelImports, HlmDialogImports,
    HlmCheckboxImports, NgIcon, TranslocoPipe, TrashBannerComponent,
    DataTableComponent, HasPermissionDirective, LocalizedDateComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft, lucidePencil, lucideTrash2, lucideImage, lucidePackage,
      lucideTag, lucideCheck, lucideX, lucideLoader2, lucideRotateCcw,
      lucideAlertCircle, lucideUpload, lucidePlus,
    }),
  ],
  templateUrl: './origin-detail.component.html',
})
export class OriginDetailComponent implements OnInit {
  private notify = inject(NotifyService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private originService = inject(OriginService);
  private breadcrumbService = inject(BreadcrumbService);
  protected translationHelper = inject(TranslationFormHelper);
  protected language = inject(LanguageService);
  private readonly storeSettings = inject(StoreSettingsService);

  protected readonly Math = Math;

  readonly origin = signal<DashboardOriginResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<EditMode>('view');

  readonly products = signal<ProductCardResponse[]>([]);
  readonly productsLoading = signal(false);
  readonly productsPage = signal<PageResponse<ProductCardResponse> | null>(null);
  readonly currentProductPage = signal(0);
  readonly productsError = signal(false);

  readonly productPageSize = signal(20);
  readonly productPageSizeOptions = [10, 20, 50] as const;

  readonly isDeleted = signal(false);
  readonly showDeleteConfirm = signal(false);
  readonly showImageDialog = signal(false);

  form!: FormGroup;

  readonly imageInput = viewChild<HTMLInputElement>('imageInput');

  readonly isEditing = computed(() => this.mode() === 'edit');
  readonly isDirty = signal(false);

  readonly displayName = computed(() => {
    const o = this.origin();
    return o?.translations.find((t) => t.language === 'en')?.name || o?.slug || '';
  });

  readonly isNew = signal(false);

  private productColumnHelper = createColumnHelper<ProductCardResponse>();

  readonly columns = computed<ColumnDef<ProductCardResponse, any>[]>(() => {
    const lang = this.language.language();
    const items = this.products();
    const helper = this.productColumnHelper;

    const entityCell = helper.accessor(
      (row) => ({ name: row.name, slug: row.slug, imageUrl: row.primaryImageUrl, otherName: '—' }),
      {
        id: `main_${lang}`,
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

  private readonly languageEffect = effect(() => {
    this.language.language();
    const origin = this.origin();
    if (origin?.slug) {
      this.loadProducts(origin.slug, this.currentProductPage());
    }
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(map((params) => params.get('slug')))
      .subscribe((slug) => {
        if (slug === 'new') {
          this.isNew.set(true);
          this.loading.set(false);
          this.buildEmptyForm();
          return;
        }
        if (!slug) {
          this.error.set('Origin not found');
          return;
        }
        this.loading.set(true);
        this.originService
          .getDashboardBySlug(slug)
          .pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load origin');
              return of(null);
            }),
          )
          .subscribe((res) => {
            this.loading.set(false);
            if (res?.data) {
              const data = res.data;
              this.isDeleted.set(!!data.deletedAt);
              this.origin.set(data);
              this.buildForm(data);
              this.loadProducts(data.slug, 0);
              const displayName = this.getTranslationName('en') || data.slug;
              this.breadcrumbService.updateLastLabel(displayName);
            }
          });
      });
  }

  private buildEmptyForm(): void {
    this.form = this.fb.group({
      code: [''],
      translations: this.translationHelper.buildArray([], ['description']),
    });
    this._updateTranslationsArray();
    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => {
      this.isDirty.set(this.form.dirty);
    });
  }

  private buildForm(data: any): void {
    this.form = this.fb.group({
      code: [data.code],
      translations: this.translationHelper.buildArray(data.translations, ['description']),
    });
    this._updateTranslationsArray();
    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => {
      this.isDirty.set(this.form.dirty);
    });
  }

  protected readonly translationsArray = signal<FormArray<FormGroup> | null>(null);

  private _updateTranslationsArray(): void {
    const ctrl = this.form?.get('translations');
    if (ctrl instanceof FormArray) {
      this.translationsArray.set(ctrl);
    }
  }

  private loadProducts(slug: string, page: number): void {
    const size = this.productPageSize();
    this.currentProductPage.set(page);
    this.productsLoading.set(true);
    this.productsError.set(false);
    this.originService
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
    const slug = this.origin()?.slug;
    if (!slug) return;
    this.currentProductPage.set(page);
    this.loadProducts(slug, page);
  }

  onProductPageSizeChange(size: number): void {
    if (size === this.productPageSize()) return;
    this.productPageSize.set(size);
    this.currentProductPage.set(0);
    const slug = this.origin()?.slug;
    if (!slug) return;
    this.loadProducts(slug, 0);
  }

  retryProducts(): void {
    const slug = this.origin()?.slug;
    if (!slug) return;
    this.loadProducts(slug, this.currentProductPage());
  }

  startEdit(): void {
    this.mode.set('edit');
  }

  discardChanges(): void {
    const data = this.origin();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;

    const slug = this.origin()?.slug;
    if (!slug) return;

    this.saving.set(true);

    const req: any = {
      code: this.form.value.code,
      translations: this.form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };

    const save$ = this.isNew()
      ? this.originService.create(req, undefined, 'multipart')
      : this.originService.update(slug, req);

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
          this.origin.set(data);
          this.isNew.set(false);
          this.mode.set('view');
          this.form.markAsPristine();

          const displayName = this.getTranslationName('en') || data.slug;
          this.breadcrumbService.updateLastLabel(displayName);
          this.router.navigate(['/dashboard/origins', data.slug]);
        }
      });
  }

  openDeleteConfirm(): void {
    this.showDeleteConfirm.set(true);
  }

  confirmDelete(): void {
    const slug = this.origin()?.slug;
    if (!slug) return;

    this.submitting.set(true);

    this.originService.delete(slug).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showDeleteConfirm.set(false);
        this.isDeleted.set(true);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message || 'Failed to delete');
      },
    });
  }

  restoreOrigin(): void {
    const origin = this.origin();
    const id = origin?.id;
    if (!id) return;

    this.originService.restore(id).subscribe({
      next: () => {
        this.isDeleted.set(false);
        this.notify.success('notify.restored', 'Restored successfully');
        const slug = this.origin()?.slug;
        if (slug) {
          this.originService.getDashboardBySlug(slug).subscribe((res) => {
            if (res?.data) {
              this.origin.set(res.data);
              this.isDeleted.set(false);
            }
          });
        }
      },
      error: (err) => this.error.set(err?.error?.message || 'Failed to restore'),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/origins']);
  }

  getTranslationName(lang: string): string {
    return this.origin()?.translations.find((t) => t.language === lang)?.name || '';
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const slug = this.origin()?.slug;
      if (!slug) return;

      this.saving.set(true);
      this.originService.update(slug, this.form.value, file, 'multipart').subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res?.data) {
            this.origin.set(res.data);
            this.notify.success('notify.updated', 'Image updated');
          }
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Failed to upload image');
        },
      });
    }
  }

  openImageDialog(): void {
    this.showImageDialog.set(true);
  }

  onImageDialogSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      (this.showImageDialog as any).file = input.files[0];
    }
  }

  confirmImageChange(): void {
    const file = (this.showImageDialog as any).file;
    if (!file) return;

    const slug = this.origin()?.slug;
    if (!slug) return;

    this.submitting.set(true);
    this.originService.update(slug, this.form.value, file, 'multipart').subscribe({
      next: () => {
        this.submitting.set(false);
        this.showImageDialog.set(false);
        this.notify.success('notify.updated', 'Image updated');
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err?.error?.message || 'Failed to upload image');
      },
    });
  }

  readonly productHref = (row: ProductCardResponse): any[] | null =>
    row?.slug ? ['/dashboard/products', row.slug, 'edit'] : null;

  fmtPrice(value: number): string {
    return formatCurrency(value, this.language.language(), this.storeSettings.currency());
  }

  fmtPct(value: number | string): string {
    return formatPercent(value, this.language.language());
  }
}