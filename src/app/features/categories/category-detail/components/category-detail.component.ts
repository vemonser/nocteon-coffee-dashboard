import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  signal,
  computed,
  effect,
  untracked,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { map, switchMap, catchError, of, Subscription, Subject, Observable } from 'rxjs';

// Spartan UI
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideAlertCircle,
  lucideTrash2,
  lucideImage,
  lucidePackage,
  lucideTag,
  lucideCheck,
  lucideX,
  lucideLoader2,
  lucideRotateCcw,
  lucideUpload,
  lucideCopy,
  lucidePlus,
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
import { StoreSettingsService } from '../../../../core/settings/store-settings.service';
import { NotifyService } from '../../../../core/notify/notify.service';
import { formatCurrency, formatPercent } from '../../../../shared/utils/locale-format';
import { LocalizedDateComponent } from '../../../../shared/ui/localized-date/localized-date.component';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { TrashBannerComponent } from '../../../../shared/components/trash-banner/trash-banner.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { CategoryFormComponent } from '../../components/category-form/category-form.component';
import { StatusCellComponent } from '../../../../shared/ui/status-cell/status-cell.component';
import { HasPermissionDirective } from '../../../../core/auth/permission.directive';
import { CanComponentDeactivate } from '../../../../core/guards/unsaved-changes.guard';

@Component({
  selector: 'app-category-detail',
  standalone: true,
  host: {
    "(document:keydown.escape)": 'onEscapeKey()',
  },
  imports: [
    PagerComponent,
    LocalizedDateComponent,
    TrashBannerComponent,
    DataTableComponent,
    StatusCellComponent,
    HasPermissionDirective,
    CategoryFormComponent,
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmSeparatorImports,
    HlmSwitchImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucideTrash2,
      lucideAlertCircle,
      lucideImage,
      lucidePackage,
      lucideTag,
      lucideCheck,
      lucideX,
      lucideLoader2,
      lucideRotateCcw,
      lucideUpload,
      lucideCopy,
      lucidePlus,
    }),
  ],
  templateUrl: './category-detail.component.html',
})
export class CategoryDetailComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  /** Escape closes the move-to-trash confirm (dialog parity). */
  onEscapeKey(): void {
    if (this.showDeleteConfirm() && !this.deleting()) this.showDeleteConfirm.set(false);
  }

  private notify = inject(NotifyService);
  private translocoService = inject(TranslocoService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private breadcrumbService = inject(BreadcrumbService);
  protected translationHelper = inject(TranslationFormHelper);
  protected readonly language = inject(LanguageService);
  private readonly storeSettings = inject(StoreSettingsService);

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

  /**
   * W1 root-cause fix: product card names are localized BY THE BACKEND
   * (Accept-Language at request time), so a UI-language switch must refetch
   * the products — the card/table cells capture `row.name`, which would
   * otherwise keep the language the products were fetched under. The
   * category itself stores a full `translations` array and needs no
   * refetch; its name (title + breadcrumb) is picked up reactively.
   *
   * The breadcrumb entity label is re-applied here as well: the service's
   * own language rebuild resets the trail to the static route-data label
   * ("Category"), and this component is the one that knows the entity's
   * current-UI-language name.
   *
   * Only `language()` is tracked on purpose — the initial load is
   * `ngOnInit`'s job, and the form (with its unsaved-changes guard) is NOT
   * rebuilt on a language switch.
   */
  private readonly languageRefresh = effect(() => {
    this.language.language();
    if (!this.languageRefreshReady) return;
    untracked(() => {
      const category = this.category();
      if (!category) return;
      this.loadProducts(category.slug, this.currentProductPage());
      this.breadcrumbService.updateLastLabel(this.displayName());
    });
  });
  /** Set once the initial load has placed real data, so the first (setup) effect run is a no-op. */
  private languageRefreshReady = false;
  readonly productsPage = signal<PageResponse<ProductCardResponse> | null>(null);
  readonly currentProductPage = signal(0);

  /**
   * Rows per page for the embedded products table. Same convention as the
   * catalog lists (`BaseListComponent`): 10 / 20 / 50, default 20, and the
   * pager's per-page select feeds it straight through to the backend as `size`.
   */
  readonly productPageSize = signal(20);
  readonly productPageSizeOptions = [10, 20, 50] as const;

  /**
   * True when the last products fetch failed. Without it the synthetic empty
   * page from the error path renders the "no products yet" copy + Add CTA and
   * the page claims the category is empty when the request simply failed.
   */
  readonly productsError = signal(false);

  // §10: show Type column only when there are multiple product types
  // NOTE: `products()` holds ONE page, so this (and the Featured check below)
  // only sees the current page. A category long enough to paginate can show or
  // hide the column between pages; the correct fix needs a per-category flag
  // from the API, and no seeded category exceeds one page today.
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
        // English-only literals: the shared table maps them through
        // `HEADER_KEYS` and renders the transloco key, so both languages get
        // the translated header. Passing the Arabic literal put a raw string
        // into the transloco pipe (a logged missing key).
        header: 'Name',
        enableSorting: false,
        // Like the lists: the entity column is the unsized flex column and
        // absorbs the leftover width.
      },
    );

    const priceCell = helper.accessor((row): string => this.priceLabel(row), {
      id: 'price',
      header: 'Price',
      enableSorting: false,
    });

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

    // Type/Featured stay out unless they carry information. Both need a real
    // accessor: a bare `{ id }` column has no value, so the shared table's
    // `type`/`featured` cases fell through to the empty placeholder (an empty
    // cell and a "—" in what was labelled the Featured column).
    const cols: ColumnDef<ProductCardResponse, any>[] = [
      entityCell,
      priceCell,
      discountCell,
      statusCell,
    ];
    if (this.uniqueProductTypes() > 1) {
      cols.push(
        helper.accessor('productType', {
          id: 'type',
          header: 'Type',
          enableSorting: false,
        }),
      );
    }
    if (items.some((p) => p.featured)) {
      cols.push(
        helper.accessor('featured', {
          id: 'featured',
          header: 'Featured',
          enableSorting: false,
        }),
      );
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
          // From here on the language effect may refetch localized data.
          this.languageRefreshReady = true;
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
    const size = this.productPageSize();
    // This method owns the page state: every caller (route param change, pager,
    // per-page change, language refetch) goes through here, so `currentProductPage`
    // can never drift from what was actually requested — a stale page number made
    // the language refetch ask for a page the (new) category does not have.
    this.currentProductPage.set(page);
    this.productsLoading.set(true);
    this.productsError.set(false);
    this.categoryService
      .getProducts(slug, { page, size })
      .pipe(
        catchError((err) => {
          this.productsError.set(true);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not load products');
          return of({
            data: {
              content: [],
              totalElements: 0,
              totalPages: 0,
              page,
              size,
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

  /**
   * Rows-per-page change from the embedded pager: back to the first page and
   * refetch with the new size — the same contract as `BaseListComponent`.
   */
  onProductPageSizeChange(size: number): void {
    if (size === this.productPageSize()) return;
    this.productPageSize.set(size);
    this.currentProductPage.set(0);
    const slug = this.category()?.slug;
    if (!slug) return;
    this.loadProducts(slug, 0);
  }

  /** Retry the failed products fetch (the error state's action). */
  retryProducts(): void {
    const slug = this.category()?.slug;
    if (!slug) return;
    this.loadProducts(slug, this.currentProductPage());
  }

  /**
   * The product NAME is the row's way into the product (a real anchor). A
   * product has no detail page in this app — the wizard is also the editor —
   * so the link goes to `/dashboard/products/{slug}/edit`, the same target the
   * products list's Edit action uses. The slug below the name stays plain text:
   * one clickable control per row — same principle as the catalog lists.
   */
  readonly productHref = (row: ProductCardResponse): any[] | null =>
    row?.slug ? ['/dashboard/products', row.slug, 'edit'] : null;

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
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          if (!res?.data) return;

          // Feedback the moment the backend answers.
          this.notify.apiSuccess(res, 'notify.updated', 'Updated successfully');

          // The PUT response echoes a flat object WITHOUT `translations`;
          // adopting it as-is would leave the form's bilingual values stale
          // (and a bare payload without the array even froze the render past
          // this point). Re-read the entity like restoreCategory does so the
          // page reflects server truth.
          this.refreshCategory(slug);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Failed to save');
        },
      });
  }

  /**
   * Re-read the category after a mutation and rebuild the form from server
   * truth. Silent — the mutation's toast already reported the outcome.
   */
  private refreshCategory(slug: string): void {
    this.categoryService
      .getDashboardBySlug(slug)
      .pipe(
        catchError((err) => {
          this.error.set(err?.error?.message || 'Failed to reload category');
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res?.data) {
          this.category.set(res.data);
          this.buildForm(res.data);
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
        if (!res?.data) return;
        // Feedback the moment the backend responds.
        this.notify.apiSuccess(res, 'notify.imageUpdated', 'Image updated');
        // The update payload is flat (no `translations`) — re-read server truth.
        this.refreshCategory(slug);
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
        this.error.set(null);
        this.notify.success('categories.trash.movedToTrash', 'Moved to trash');
        // Replace the dead detail in history — Back must not land on a trashed slug.
        this.router.navigate(['/dashboard/categories'], {
          queryParams: { view: 'trash' },
          replaceUrl: true,
        });
      },
      error: (err) => {
        this.deleting.set(false);
        this.showDeleteConfirm.set(false);
        // The backend's reason wins (409: category still has products) — the
        // toast carries it, and the page keeps it visible in a banner.
        this.notify.apiError(err, 'common.deleteFailed', 'Failed to move to trash');
        this.error.set(
          err?.error?.message ||
            this.translocoService.translate('common.deleteFailed') ||
            'Failed to move to trash',
        );
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
            this.error.set(null);
            this.notify.success('notify.restored', 'Restored successfully');
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
        this.notify.apiError(err, 'common.restoreFailed', 'Failed to restore');
        this.error.set(
          err?.error?.message ||
            this.translocoService.translate('common.restoreFailed') ||
            'Failed to restore',
        );
      },
    });
  }

  goBack(): void {
    // The unsaved-changes modal (if dirty) runs through canDeactivate,
    // so the guard shows the SAME modal the router shows — one flow.
    this.router.navigate(['/dashboard/categories']);
  }

  /**
   * Unsaved-changes gate. Returns an Observable so Angular's router waits for
   * the in-page modal decision instead of a `confirm()` alert. The modal must
   * be closed exactly once per navigation attempt — `resolveLeave` handles it.
   */
  private pendingLeave: Subject<boolean> | null = null;
  readonly showLeaveModal = signal(false);

  canDeactivate(): boolean | Observable<boolean> {
    if (!this.isDirty()) return true;

    // One dialog at a time: repeated navigation attempts during an open
    // dialog subscribe to the SAME decision.
    if (!this.pendingLeave) {
      this.showLeaveModal.set(true);
      this.pendingLeave = new Subject<boolean>();
    }
    return this.pendingLeave.asObservable();
  }

  /** Modal "Cancel" — stay on the page, keep the dirty form. */
  stayOnPage(): void {
    this.resolveLeave(false);
  }

  /** Modal "Leave" — discard edits and let the navigation proceed. */
  leaveWithoutSaving(): void {
    this.isDirty.set(false);
    this.resolveLeave(true);
  }

  private resolveLeave(allow: boolean): void {
    if (!this.pendingLeave) return;
    this.showLeaveModal.set(false);
    this.pendingLeave.next(allow);
    this.pendingLeave.complete();
    this.pendingLeave = null;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
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
    return formatCurrency(value, this.language.language(), this.storeSettings.currency());
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
    // `translations` may be absent in some response payloads — reading `.find`
    // on undefined froze the whole page render (loader stuck on "Saving...").
    return this.category()?.translations?.find((t) => t.language === lang)?.name || '';
  }

  get translationsArray() {
    return this.form?.get('translations') as any;
  }
}
