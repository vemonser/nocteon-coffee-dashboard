import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { map, switchMap, catchError, of, tap, Subscription } from 'rxjs';

// Spartan UI
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmTableImports } from '@spartan-ng/helm/table';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideTrash2,
  lucideImage,
  lucidePackage,
  lucideTag,
  lucideCheck,
  lucideX,
  lucideLoader2,
  lucideGrid3x3,
  lucideList,
  lucideEye,
  lucideRotateCcw,
  lucideUpload,
  lucideStar,
  lucideCopy,
} from '@ng-icons/lucide';
import { CategoryService } from '../../services/category.service';
import { TranslationFormHelper } from '../../../../shared/utils/translation.utils';
import {
  CategoryRequest,
  DashboardCategoryResponse,
  ProductCardResponse,
} from '../../models/category.model';
import { PageResponse } from '../../../../core/models/api-response.model';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';

import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { LanguageService } from '../../../../core/i18n/language.service';
import { NotifyService } from '../../../../core/notify/notify.service';
import { formatCurrency, formatPercent } from '../../../../shared/utils/locale-format';
import { LocalizedDateComponent } from '../../../../shared/ui/localized-date/localized-date.component';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { TrashBannerComponent } from '../../../../shared/components/trash-banner/trash-banner.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { CategoryFormComponent } from '../../components/category-form/category-form.component';
import { StatusCellComponent } from '../../../../shared/ui/status-cell/status-cell.component';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';

type ViewMode = 'list' | 'grid';

@Component({
  selector: 'app-category-detail',
  standalone: true,
  imports: [
    PagerComponent,
    LocalizedDateComponent,
    TrashBannerComponent,
    DataTableComponent,
    StatusCellComponent,
    StatusBadgeComponent,
    CategoryFormComponent,
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSkeletonImports,
    HlmSeparatorImports,
    HlmSwitchImports,
    HlmTableImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideTrash2,
      lucideImage,
      lucidePackage,
      lucideTag,
      lucideCheck,
      lucideX,
      lucideLoader2,
      lucideGrid3x3,
      lucideList,
      lucideEye,
      lucideRotateCcw,
      lucideUpload,
      lucideStar,
      lucideCopy,
    }),
  ],
  templateUrl: './category-detail.component.html',
})
export class CategoryDetailComponent implements OnInit, OnDestroy {
  private notify = inject(NotifyService);
  private translocoService = inject(TranslocoService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private breadcrumbService = inject(BreadcrumbService);
  protected translationHelper = inject(TranslationFormHelper);
  protected readonly language = inject(LanguageService);

  // Category state
  readonly category = signal<DashboardCategoryResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  /** §10: a deleted category opened directly is read-only with a banner. */
  readonly isDeleted = computed(() => !!this.category()?.deletedAt);

  /** Move-to-trash confirm (states the product impact, §10). */
  readonly showDeleteConfirm = signal(false);
  readonly deleting = signal(false);

  // Image upload
  readonly uploadingImage = signal(false);
  readonly imageError = signal<string | null>(null);

  // Products state
  readonly products = signal<ProductCardResponse[]>([]);
  readonly productsLoading = signal(false);
  readonly productsPage = signal<PageResponse<ProductCardResponse> | null>(null);
  readonly productViewMode = signal<ViewMode>('grid');
  readonly currentProductPage = signal(0);

  // §10: show Type column only when there are multiple product types
  readonly uniqueProductTypes = computed(() => {
    const types = this.products()
      .map((p) => p.productType)
      .filter((t): t is string => !!t);
    return new Set(types).size;
  });

  /** Column definitions for the embedded products list on the detail page. */
  /**
   * Products table columns — the same shared-DataTable pattern the list pages
   * use: an entity main-cell (thumbnail + name + slug) instead of a separate
   * Image column, then price/discount as text, and isActive which the shared
   * table renders with the shared StatusBadge. Type/Featured only exist when
   * they carry information (more than one product type / at least one featured).
   */
  private productColumnHelper = createColumnHelper<ProductCardResponse>();

  readonly columns = computed<ColumnDef<ProductCardResponse, any>[]>(() => {
    const lang = this.language.language();
    const items = this.products();
    const helper = this.productColumnHelper;

    const entityCell = helper.accessor(
      (row) => ({ name: row.name, slug: row.slug, imageUrl: row.primaryImageUrl, otherName: '—' }),
      {
        id: `main_${lang}`,
        header: lang === 'en' ? 'Name' : 'الاسم',
        enableSorting: false,
        // Like the lists: the entity column is the unsized flex column and
        // absorbs the leftover width.
      },
    );

    const priceCell = helper.accessor((row): string => this.priceLabel(row), {
      id: 'price',
      header: lang === 'en' ? 'Price' : 'السعر',
      enableSorting: false,
    });

    const discountCell = helper.accessor(
      (row): string => (row.discountPercentage ? this.fmtPct(row.discountPercentage) : '—'),
      {
        id: 'discount',
        header: lang === 'en' ? 'Discount' : 'الخصم',
        enableSorting: false,
      },
    );

    const statusCell = helper.accessor('isActive', {
      header: lang === 'en' ? 'Status' : 'الحالة',
      enableSorting: false,
    });

    // Type/Featured stay out unless they carry information.
    const cols: ColumnDef<ProductCardResponse, any>[] = [
      entityCell,
      priceCell,
      discountCell,
      statusCell,
    ];
    if (this.uniqueProductTypes() > 1) {
      cols.push({
        id: 'type',
        header: lang === 'en' ? 'Type' : 'النوع',
        enableSorting: false,
      });
    }
    if (items.some((p) => p.featured)) {
      cols.push({
        id: 'featured',
        header: lang === 'en' ? 'Featured' : 'مميز',
        enableSorting: false,
      });
    }
    return cols;
  });

  // Form — always editable (§10); the save bar tracks dirtiness.
  form!: FormGroup;

  readonly isDirty = signal(false);

  private formSub?: Subscription;

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug')),
        switchMap((slug) => {
          if (!slug) {
            this.error.set('Category not found');
            return of(null);
          }
          this.loading.set(true);
          return this.categoryService.getDashboardBySlug(slug).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load category');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          this.category.set(res.data);
          this.buildForm(res.data);
          this.loadProducts(res.data.slug, 0);

          // Replace the last breadcrumb segment with the UI-language name.
          this.breadcrumbService.updateLastLabel(this.displayName());
        }
      });
  }

  private buildForm(data: DashboardCategoryResponse): void {
    this.form = this.fb.group({
      isActive: [data.isActive],
      translations: this.translationHelper.buildArray(data.translations, ['description']),
    });

    // A trashed category is read-only until restored.
    if (data.deletedAt) this.form.disable();

    this.isDirty.set(false);
    // One subscription at a time — buildForm re-runs on discard/save/upload.
    this.formSub?.unsubscribe();
    this.formSub = this.form.valueChanges.subscribe(() => {
      this.isDirty.set(this.form.dirty);
    });
  }

  private requestFromForm(): CategoryRequest {
    return {
      isActive: this.form.value.isActive,
      translations: this.form.value.translations.map((t: any) => ({
        language: t.language,
        name: t.name,
        description: t.description || undefined,
      })),
    };
  }

  // ─── Products ──────────────────────────────────────────────────────────────

  private loadProducts(slug: string, page: number): void {
    this.productsLoading.set(true);
    this.categoryService
      .getProducts(slug, { page, size: 8 })
      .pipe(
        catchError((err) => {
          this.notify.apiError(err, 'notify.errorFallback', 'Could not load products');
          return of({
            data: {
              content: [],
              totalElements: 0,
              totalPages: 0,
              page,
              size: 8,
              first: true,
              last: true,
            },
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
    const slug = this.category()?.slug;
    if (!slug) return;
    this.currentProductPage.set(page);
    this.loadProducts(slug, page);
  }

  toggleProductView(mode: ViewMode): void {
    this.productViewMode.set(mode);
  }

  openProduct(slug: string): void {
    this.router.navigate(['/dashboard/products', slug]);
  }

  // ─── Save bar ──────────────────────────────────────────────────────────────

  discardChanges(): void {
    const data = this.category();
    if (data) this.buildForm(data);
  }

  saveChanges(): void {
    if (this.form.invalid || this.isDeleted()) return;

    // Resolve slug before flipping `saving` to true, so a missing slug
    // can never leave the Save button stuck on "Saving...".
    const slug = this.category()?.slug;
    if (!slug) return;

    this.saving.set(true);

    this.categoryService
      .update(slug, this.requestFromForm())
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
          this.category.set(res.data);
          this.form.markAsPristine();
          this.isDirty.set(false);

          // Keep the breadcrumb in sync if the name changed during this edit.
          this.breadcrumbService.updateLastLabel(this.displayName());
        }
      });
  }

  // ─── Image ─────────────────────────────────────────────────────────────────

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const slug = this.category()?.slug;
    if (!slug || this.isDeleted()) return;

    this.uploadingImage.set(true);
    this.imageError.set(null);

    this.categoryService.update(slug, this.requestFromForm(), file).subscribe({
      next: (res) => {
        this.uploadingImage.set(false);
        if (res?.data) {
          this.category.set(res.data);
          this.buildForm(res.data);
        }
      },
      error: (err) => {
        this.uploadingImage.set(false);
        this.imageError.set(err?.error?.message || 'Image upload failed');
      },
    });
  }

  // ─── Move to trash / restore ───────────────────────────────────────────────

  moveToTrash(): void {
    const slug = this.category()?.slug;
    if (!slug || this.deleting()) return;

    this.deleting.set(true);
    this.categoryService.delete(slug).subscribe({
      next: () => {
        this.deleting.set(false);
        this.showDeleteConfirm.set(false);
        // Replace the dead detail in history — Back must not land on a trashed slug.
        this.router.navigate(['/dashboard/categories'], {
          queryParams: { view: 'trash' },
          replaceUrl: true,
        });
      },
      error: (err) => {
        this.deleting.set(false);
        this.error.set(err?.error?.message || 'Failed to move to trash');
      },
    });
  }

  restoreCategory(): void {
    const id = this.category()?.id;
    if (id === undefined || this.saving()) return;

    this.saving.set(true);
    this.categoryService.restore(id).subscribe({
      next: () => {
        // Re-read so the trash banner, badge and editable state all flip back.
        const slug = this.category()?.slug;
        if (!slug) {
          this.saving.set(false);
          return;
        }
        this.categoryService.getDashboardBySlug(slug).subscribe({
          next: (res) => {
            this.saving.set(false);
            if (res?.data) {
              this.category.set(res.data);
              this.buildForm(res.data);
            }
          },
          error: () => this.saving.set(false),
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'Failed to restore');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/categories']);
  }

  /** Copy the entity ID to the clipboard. */
  copyId(): void {
    const id = this.category()?.id;
    if (id === undefined || id === null) return;
    const idStr = String(id);
    navigator.clipboard.writeText(idStr).then(() => {
      this.notify.success('notify.copied', 'ID copied to clipboard');
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = idStr;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.notify.success('notify.copied', 'ID copied to clipboard');
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Phase 1.3: name in the UI language, falling back to the other language,
   * then to the slug. Used by the h1 and the breadcrumb alike.
   */
  displayName(): string {
    const lang = this.language.language();
    const other = lang === 'ar' ? 'en' : 'ar';
    return (
      this.getTranslationName(lang) || this.getTranslationName(other) || this.category()?.slug || ''
    );
  }

  fmtPrice(value: unknown): string {
    return formatCurrency(value, this.language.language());
  }

  /** Single price, or the localized range `from … to …` when min ≠ max. */
  priceLabel(row: ProductCardResponse): string {
    return row.minPrice === row.maxPrice
      ? this.fmtPrice(row.minPrice)
      : this.translocoService.translate('categories.detail.priceRange', {
          min: this.fmtPrice(row.minPrice),
          max: this.fmtPrice(row.maxPrice),
        });
  }

  fmtPct(value: unknown): string {
    return formatPercent(value, this.language.language());
  }

  getTranslationName(lang: string): string {
    return this.category()?.translations.find((t) => t.language === lang)?.name || '';
  }

  get translationsArray() {
    return this.form?.get('translations') as any;
  }
}
