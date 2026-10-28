import { Component, computed, inject, signal } from '@angular/core';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataTableComponent, TableSortEvent } from '../../../../shared/components/data-table/data-table.component';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideChevronLeft,
  lucideChevronRight,
  lucideX,
  lucidePlus,
  lucideArrowRight,
  lucideCopy,
  lucideExternalLink,
  lucideTrash2,
} from '@ng-icons/lucide';
import { PageResponse } from '../../../../core/models/api-response.model';
import { ProductListItem, ProductListParams, ProductType } from '../../models/product.models';
import { ProductService } from '../../services/product.service';
import { ProductTagService } from '../../../product-tags/services/product-tag.service';
import { ProductTag } from '../../../product-tags/models/product-tag.model';
import { CategoryTranslationService } from '../../../../shared/services/category-translation.service';
import { HasPermissionDirective } from '../../../../core/auth/permission.directive';
import { AuthService } from '../../../../core/auth/auth.service';
import { LifecycleTabsComponent } from '../../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { TrashBannerComponent } from '../../../../shared/components/trash-banner/trash-banner.component';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { NotifyService } from '../../../../core/notify/notify.service';
import { RowMenuAction } from '../../../../shared/ui/actions-cell/actions-cell.component';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [
    PagerComponent,
    CommonModule,
    ReactiveFormsModule,
    DataTableComponent,
    LifecycleTabsComponent,
    TrashBannerComponent,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmSelectImports,
    HasPermissionDirective,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideChevronLeft,
      lucideChevronRight,
      lucideX,
      lucideArrowRight,
      lucidePlus,
      lucideCopy,
      lucideExternalLink,
      lucideTrash2,
    }),
  ],
  templateUrl: './products-list.component.html',
})
export class ProductsListComponent {
  private productService = inject(ProductService);
  private categoryTranslationService = inject(CategoryTranslationService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  /** The low-stock drill-down: the products LIST api has no stock filter. */
  readonly lowStockOnly = signal(false);
  private notify = inject(NotifyService);
  private confirmDialog = inject(ConfirmDialogService);
  private readonly transloco = inject(TranslocoService);
  private readonly productTagService = inject(ProductTagService);

  /** FE-10: the tag vocabulary for the filter, loaded once. */
  readonly productTags = signal<ProductTag[]>([]);

  /** Mirrors the search box so the empty-state copy can react to it. */
  private readonly searchText = signal('');

  /**
   * Filter labels for the select triggers. The spartan value element prints
   * the raw control value ("all"/""), because the options live in a portal
   * and the value template exposes no context — so the trigger shows this
   * translated label instead (the primitive value stays for a11y, sr-only).
   */
  readonly typeLabel = (value: string): string =>
    this.transloco.translate(
      value === 'COFFEE'
        ? 'products.form.productTypes.COFFEE'
        : value === 'EQUIPMENT'
          ? 'products.form.productTypes.EQUIPMENT'
          : 'products.filters.allTypes',
    );

  readonly statusLabel = (value: string): string =>
    this.transloco.translate(
      value === 'active'
        ? 'products.status.active'
        : value === 'inactive'
          ? 'products.status.inactive'
          : 'products.filters.allStatuses',
    );

  readonly featuredLabel = (value: string): string =>
    this.transloco.translate(
      value === 'featured'
        ? 'products.featured.featuredOnly'
        : value === 'notFeatured'
          ? 'products.featured.notFeatured'
          : 'products.filters.allFeatured',
    );

  /** The tag select trigger reads the tag's name, never its slug. */
  readonly tagLabel = (value: string): string => {
    if (!value) return this.transloco.translate('products.filters.allTags');
    const tag = this.productTags().find((t) => t.slug === value);
    return tag ? this.tagName(tag) : value;
  };

  tagName(tag: ProductTag): string {
    const language = this.transloco.getActiveLang();
    return (
      tag.translations.find((t) => t.language === language)?.title ??
      tag.translations.find((t) => t.language === 'en')?.title ??
      tag.slug
    );
  }

  /** What the empty state says — and what it offers as the next step (#5). */
  readonly emptyMessage = computed(() => {
    if (this.isTrash()) return this.transloco.translate('products.empty.trash');
    const q = this.searchText().trim();
    return q
      ? this.transloco.translate('products.empty.search', { q })
      : this.transloco.translate('products.empty.none');
  });

  readonly emptyAction = computed<{ label: string; action: () => void } | null>(() => {
    if (this.isTrash()) return null;
    const q = this.searchText().trim();
    return q
      ? {
          label: this.transloco.translate('products.empty.clear'),
          action: () => this.filters.patchValue({ search: '' }),
        }
      : {
          label: this.transloco.translate('products.add'),
          action: () => this.goToCreate(),
        };
  });

  readonly canManageTrash = this.authService.hasPermission('product:delete');
  readonly isTrashAllowed = computed(() => this.authService.hasPermission('product:delete'));

  viewMode = signal<'active' | 'trash'>('active');
  readonly isTrash = computed(() => this.viewMode() === 'trash');

  protected readonly Math = Math;

  /** Set from ?category=<slug> (e.g. category detail "View all"). Cleared via the chip. */
  readonly categorySlug = signal<string | null>(null);

  items = signal<ProductListItem[]>([]);
  pageData = signal<PageResponse<ProductListItem> | null>(null);
  loading = signal(false);
  currentPage = signal(0);
  pageSize = signal(20);
  selectedIds = signal<ReadonlySet<number>>(new Set());
  readonly hasStockData = signal(false);

  currentSort = 'createdAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  private searchTimeout: any;

  readonly filters = new FormGroup({
    search: new FormControl(''),
    // '' = "no filter". The select triggers then show their translated
    // placeholder ("All types"), instead of the raw control value 'all'.
    status: new FormControl(''),
    featured: new FormControl(''),
    type: new FormControl(''),
    /** FE-10: '' = every tag. */
    tag: new FormControl(''),
  });

  readonly loadError = signal(false);

  readonly totalItems = computed(() => this.pageData()?.totalElements ?? 0);
  readonly activeCount = signal(0);
  readonly trashCount = signal(0);

  /** The row currently being duplicated, so a double click cannot create two copies. */
  readonly duplicatingId = signal<number | null>(null);
  /** Duplicating creates a product, so it follows product:create. */
  readonly canCreate = this.authService.hasPermission('product:create');

  readonly bulkProgress = signal<{ done: number; total: number } | null>(null);
  readonly bulkErrors = signal<string[]>([]);
  readonly bulkBusy = signal(false);

  private columnHelper = createColumnHelper<ProductListItem>();

  readonly columns = computed<ColumnDef<ProductListItem, any>[]>(() => {
    const mainCol = this.columnHelper.accessor(
      (row) => ({
        name: row.name,
        slug: row.slug,
        imageUrl: row.primaryImageUrl,
        otherName: row.name,
      }),
      { id: 'main_en', header: 'Product', enableSorting: true, meta: { width: '260px' } },
    );
    const typeCol = this.columnHelper.accessor('productType', {
      id: 'productType',
      header: 'Type',
      enableSorting: false,
      meta: { width: '90px' },
    });
    const categoryCol = this.columnHelper.accessor((row) => row.categoryName || row.categorySlug, {
      header: 'Category',
      enableSorting: false,
      id: 'category',
      meta: { width: '105px' },
    });
    const priceCol = this.columnHelper.accessor((row) => ({ min: row.minPrice, max: row.maxPrice }), {
      id: 'productPrice',
      header: 'Price',
      enableSorting: true,
      meta: { width: '175px' },
    });
    const stockCol = this.columnHelper.accessor(
      (row) => ({
        stock: row.totalStock ?? null,
        variants: row.variantsCount ?? null,
        low: row.lowStockVariantCount ?? null,
      }),
      { id: 'productStock', header: 'Stock', enableSorting: false, meta: { width: '105px' } },
    );
    const statusCol = this.columnHelper.accessor('isActive', {
      header: 'Status',
      enableSorting: false,
      meta: { width: '95px' },
    });
    const featuredCol = this.columnHelper.accessor('featured', {
      header: 'Featured',
      enableSorting: false,
      meta: { width: '90px' },
    });
    const actionsCol = this.columnHelper.display({ id: 'actions', header: 'Actions', meta: { width: '56px' } });

    // The Stock column is always present: a column that appears only when the
    // data answers re-lays-out the whole table and moves every cell (CLS,
    // UX_AUDIT_products.md #3) and makes the empty state lose a column (#5).
    // A missing stock value simply renders an empty cell.
    const cols: ColumnDef<ProductListItem, any>[] = [mainCol, typeCol, categoryCol, priceCol, stockCol];
    cols.push(statusCol, featuredCol, actionsCol);
    return cols;
  });

  readonly editHref = (row: ProductListItem) => ['/dashboard/products', row.slug, 'edit'];

  readonly menuActionsFor = (row: ProductListItem): RowMenuAction[] => [
    { id: 'edit', label: 'common.edit', icon: 'lucidePencil' },
    {
      id: 'view',
      label: 'products.actions.viewOnStorefront',
      icon: 'lucideExternalLink',
      disabled: !row.isActive,
      tooltip: !row.isActive ? 'Product is disabled' : undefined,
    },
    // Duplicating creates a product, so it needs the create grant — not the update grant that
    // opens the menu at all.
    ...(this.canCreate ? [{ id: 'duplicate', label: 'products.actions.duplicate', icon: 'lucideCopy' }] : []),
    {
      id: 'toggleActive',
      label: row.isActive ? 'products.actions.disable' : 'products.actions.enable',
      icon: 'lucideCircleSlash',
    },
    {
      id: 'toggleFeatured',
      label: row.featured ? 'products.actions.unfeature' : 'products.actions.feature',
      icon: 'lucideStar',
    },
    { id: 'separator', label: '' },
    {
      id: 'trash',
      label: 'products.actions.moveToTrash',
      icon: 'lucideTrash2',
      danger: true,
    },
  ];

  constructor() {
    // The URL is the request. Read it first, remember what the first load
    // answers, then let every control WRITE the URL and let the subscription
    // below do the loading — the same contract the orders list follows.
    this.readUrl();
    this.loadedState = JSON.stringify(this.currentState());
    this.load();

    this.productTagService.getAll().subscribe({
      next: (res) => this.productTags.set(res.data ?? []),
      // A failed tag preload must not break the list; the filter simply has no options.
      error: () => this.productTags.set([]),
    });

    this.route.queryParamMap.subscribe((params) => {
      const next = this.stateFromParams(params);
      if (JSON.stringify(next) !== this.loadedState) {
        this.applyState(next);
        this.load();
      }
    });

    // A control never loads directly: it writes the URL. Typing is debounced
    // (350ms) and always replaces the history entry, so Back steps between
    // pages rather than between keystrokes.
    let previousSearch = `${this.filters.value.search ?? ''}`;
    this.filters.valueChanges.subscribe((value) => {
      const search = `${value.search ?? ''}`;
      const searchChanged = search !== previousSearch;
      previousSearch = search;
      this.searchText.set(search);
      if (this.urlDebounce) clearTimeout(this.urlDebounce);
      if (searchChanged) {
        this.urlDebounce = setTimeout(() => this.syncUrl(true), 350);
      } else {
        this.currentPage.set(0);
        this.syncUrl(true);
      }
    });
  }

  clearCategoryFilter(): void {
    this.categorySlug.set(null);
    this.currentPage.set(0);
    this.syncUrl(true);
  }

  setListView(mode: 'active' | 'trash'): void {
    this.viewMode.set(mode);
    this.currentPage.set(0);
    this.syncUrl(true);
  }

  // ── URL state ────────────────────────────────────────────────────────────

  /** The state the rows on screen were loaded with (see orders-list). */
  private loadedState = '';

  private urlDebounce: ReturnType<typeof setTimeout> | null = null;

  private currentState() {
    return {
      search: `${this.filters.value.search ?? ''}`,
      status: `${this.filters.value.status ?? 'all'}`,
      featured: `${this.filters.value.featured ?? 'all'}`,
      type: `${this.filters.value.type ?? 'all'}`,
      tag: `${this.filters.value.tag ?? ''}`,
      category: this.categorySlug(),
      lowStock: this.lowStockOnly(),
      sort: this.currentSort,
      direction: this.currentDirection,
      page: this.currentPage(),
      size: this.pageSize(),
      view: this.viewMode(),
    };
  }

  private stateFromParams(params: import('@angular/router').ParamMap) {
    const pick = (key: string, allowed: readonly string[], fallback: string): string => {
      const value = params.get(key) ?? '';
      return allowed.includes(value) ? value : fallback;
    };
    const size = Number(params.get('size') ?? 20);

    return {
      search: params.get('q') ?? '',
      status: pick('status', ['', 'active', 'inactive'], ''),
      featured: pick('featured', ['', 'featured', 'notFeatured'], ''),
      type: pick('type', ['', 'COFFEE', 'EQUIPMENT'], ''),
      tag: params.get('tag') ?? '',
      category: params.get('category'),
      lowStock: params.get('stock') === 'low',
      sort: params.get('sort') ?? 'createdAt',
      direction: (params.get('direction') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
      page: Math.max(0, Number(params.get('page') ?? 0) || 0),
      size: [10, 20, 50].includes(size) ? size : 20,
      view: (params.get('view') === 'trash' ? 'trash' : 'active') as 'active' | 'trash',
    };
  }

  private readUrl(): void {
    this.applyState(this.stateFromParams(this.route.snapshot.queryParamMap));
  }

  private applyState(state: ReturnType<ProductsListComponent['stateFromParams']>): void {
    this.viewMode.set(state.view);
    this.categorySlug.set(state.category);
    this.lowStockOnly.set(state.lowStock);
    this.currentSort = state.sort;
    this.currentDirection = state.direction;
    this.currentPage.set(state.page);
    this.pageSize.set(state.size);
    // emitEvent: false — applying the URL must not write the URL back.
    this.searchText.set(state.search);
    this.filters.setValue(
      { search: state.search, status: state.status, featured: state.featured, type: state.type, tag: state.tag },
      { emitEvent: false },
    );
  }

  private syncUrl(replace: boolean): void {
    const f = this.filters.value;
    const params: Record<string, string> = {};
    if (this.categorySlug()) params['category'] = this.categorySlug()!;
    if (this.lowStockOnly()) params['stock'] = 'low';
    if (this.isTrash()) params['view'] = 'trash';
    if (f.search?.trim()) params['q'] = f.search.trim();
    if (f.status && f.status !== 'all') params['status'] = f.status;
    if (f.featured && f.featured !== 'all') params['featured'] = f.featured;
    if (f.type && f.type !== 'all') params['type'] = f.type;
    if (f.tag) params['tag'] = f.tag;
    if (this.currentSort !== 'createdAt') params['sort'] = this.currentSort;
    if (this.currentDirection !== 'desc') params['direction'] = this.currentDirection;
    if (this.currentPage() > 0) params['page'] = `${this.currentPage()}`;
    if (this.pageSize() !== 20) params['size'] = `${this.pageSize()}`;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: replace,
    });
  }

  load(): void {
    // Remember what this request is FOR: the URL subscription compares the
    // next URL against the last LOADED state, so clearing a filter back to
    // the initial state still reloads (it compared against the constructor
    // snapshot before, and "back to the start" looked like "no change").
    this.loadedState = JSON.stringify(this.currentState());
    this.loading.set(true);
    if (this.isTrash()) {
      this.loadTrash();
      return;
    }
    const f = this.filters.value;
    const params: ProductListParams = {
      page: this.currentPage(),
      size: this.pageSize(),
      search: f.search || undefined,
      categorySlug: this.categorySlug() ?? undefined,
      isActive: !f.status || f.status === 'all' ? undefined : f.status === 'active',
      featured: !f.featured || f.featured === 'all' ? undefined : f.featured === 'featured',
      productType: !f.type || f.type === 'all' ? undefined : (f.type as ProductType),
      tagSlug: f.tag || undefined,
      sort: this.currentSort,
      direction: this.currentDirection,
    };

    this.productService.getAll(params).subscribe({
      next: (res) => {
        // Map API response to ProductListItem for consistency
        const products = (res.data.content ?? []).map((p: any) => ({
          id: p.id,
          slug: p.slug,
          categorySlug: p.categorySlug || '',
          productType: p.productType || 'COFFEE',
          featured: p.featured ?? false,
          active: p.active ?? p.isActive ?? true,
          isActive: p.active ?? p.isActive ?? true,
          name: p.name ?? (p.translations?.find((t: any) => t.language === 'en')?.name ?? ''),
          shortDescription: p.shortDescription ?? null,
          primaryImageUrl: p.primaryImageUrl ?? p.imageUrl ?? null,
          minPrice: p.minPrice ?? 0,
          maxPrice: p.maxPrice ?? 0,
          discountPercentage: p.discountPercentage ?? null,
          // ProductCardResponse does not carry these yet — see DECISIONS.md.
          totalStock: p.totalStock ?? null,
          variantsCount: p.variantsCount ?? null,
          lowStockVariantCount: p.lowStockVariantCount ?? null,
          stockStatus: 'unknown' as const,
        }));

        this.hasStockData.set(products.some((p: any) => p.totalStock != null || p.variantsCount != null || p.lowStockVariantCount != null));

        // Fetch category names for display
        const categorySlugs = [...new Set(products.map((p: any) => p.categorySlug).filter(Boolean))];
        if (categorySlugs.length > 0) {
          this.categoryTranslationService.getCategoryNames(categorySlugs).subscribe({
            next: (categoryNameMap) => {
              const productsWithNames = products.map(product => ({
                ...product,
                categoryName: categoryNameMap.get(product.categorySlug) || product.categorySlug
              }));
              this.items.set(productsWithNames);
            },
            error: () => {
              this.items.set(products);
            }
          });
        } else {
          this.items.set(products);
        }

        this.pageData.set(res.data);
        this.selectedIds.set(new Set());
        this.activeCount.set(res.data.totalElements ?? 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(true);
        this.loading.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load products');
      },
    });
  }

  private loadTrash(): void {
    const params: ProductListParams = {
      page: this.currentPage(),
      size: this.pageSize(),
      search: this.filters.value.search || undefined,
      sort: this.currentSort,
      direction: this.currentDirection,
    };
    this.productService.getDeleted(params).subscribe({
      next: (res: any) => {
        this.selectedIds.set(new Set());
        const products: any[] = (res.data.content ?? []).map((p: any) => ({
          id: p.id,
          name: p.name ?? (p.translations?.find((t: any) => t.language === 'en')?.name ?? ''),
          slug: p.slug,
          categorySlug: p.categorySlug || '',
          productType: p.productType || 'COFFEE',
          primaryImageUrl: p.primaryImageUrl ?? p.imageUrl ?? null,
          minPrice: p.minPrice ?? 0,
          maxPrice: p.maxPrice ?? 0,
          active: p.active ?? p.isActive ?? true,
          isActive: p.active ?? p.isActive ?? true,
          featured: p.featured ?? false,
          totalStock: null,
          variantsCount: null,
          lowStockVariantCount: null,
          stockStatus: 'unknown' as const,
        }));

        this.hasStockData.set(products.some((p: any) => p.totalStock != null || p.variantsCount != null || p.lowStockVariantCount != null));

        // Fetch category names for display
        const categorySlugs = [...new Set(products.map((p: any) => p.categorySlug).filter(Boolean))];
        if (categorySlugs.length > 0) {
          this.categoryTranslationService.getCategoryNames(categorySlugs).subscribe({
            next: (categoryNameMap) => {
              const productsWithNames = products.map(product => ({
                ...product,
                categoryName: categoryNameMap.get(product.categorySlug) || product.categorySlug
              }));
              this.items.set(productsWithNames);
            },
            error: () => {
              this.items.set(products);
            }
          });
        } else {
          this.items.set(products);
        }

        this.pageData.set({ ...res.data, content: products } as any);
        this.trashCount.set(res.data.totalElements ?? 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(true);
        this.loading.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load products');
      },
    });
  }

  /**
   * FE-12: the API copies the whole graph and answers with the copy, so the wizard can open on
   * it. Navigating first (the old dead `/duplicate` route) left the admin on a 404.
   */
  duplicateProduct(product: ProductListItem): void {
    if (this.duplicatingId() !== null) return;
    this.duplicatingId.set(product.id);
    this.productService.duplicate(product.slug).subscribe({
      next: (res) => {
        this.duplicatingId.set(null);
        this.notify.success('products.duplicated', 'Product duplicated');
        void this.router.navigate(['/dashboard/products', res.data.slug, 'edit']);
      },
      error: (err) => {
        this.duplicatingId.set(null);
        this.notify.apiError(err, 'products.duplicateFailed', 'Could not duplicate the product');
      },
    });
  }

  restore(product: ProductListItem): void {
    this.productService.restore(product.id).subscribe({
      next: () => {
        this.load();
        this.notify.success('notify.restored', 'Restored successfully');
      },
      error: (err) => this.notify.apiError(err, 'notify.errorFallback', 'Could not restore'),
    });
  }

  /**
   * Moving to Trash is REVERSIBLE, so it runs immediately and the toast
   * carries the way back (8s). No confirm dialog — a dialog that says
   * "cannot be undone" over a restorable action taught the reader the wrong
   * thing (UX_AUDIT_products.md #2 / decision D2-A).
   */
  trashProduct(product: ProductListItem): void {
    this.productService.delete(product.slug).subscribe({
      next: () => {
        this.load();
        this.notify.successWithAction(
          'common.movedToTrash',
          'Moved to trash',
          this.notify.t('common.undo', 'Undo'),
          () => this.restore(product),
        );
      },
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not move to Trash'),
    });
  }

  /** Permanent delete exists only in the Trash view and is truly irreversible. */
  async openPermanentDelete(product: ProductListItem): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: this.notify.t('products.deleteTitle', 'Delete product'),
      message: `${this.notify.t('products.deleteConfirm', 'Are you sure you want to delete')} ${product.slug}? ${this.notify.t('products.deleteWarning', 'This action cannot be undone.')}`,
      confirmLabel: this.notify.t('products.delete', 'Delete'),
      cancelLabel: this.notify.t('products.cancel', 'Cancel'),
      tone: 'destructive',
    });
    if (!ok) return;

    this.productService.deletePermanently(product.id).subscribe({
      next: () => {
        this.load();
        this.notify.success('notify.deleted', 'Deleted permanently');
      },
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not delete permanently'),
    });
  }

  onSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(0);
      this.load();
    }, 400);
  }

  protected onSelectionChange(event: { id: number; checked: boolean }): void {
    const next = new Set(this.selectedIds());
    if (event.checked) next.add(event.id);
    else next.delete(event.id);
    this.selectedIds.set(next);
  }

  protected onToggleAll(checked: boolean): void {
    if (!checked) {
      this.selectedIds.set(new Set());
      return;
    }
    this.selectedIds.set(new Set(this.items().map((p) => p.id)));
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  protected bulkEnable(): void {
    this.runBulk('enable');
  }

  protected bulkDisable(): void {
    this.runBulk('disable');
  }

  protected bulkFeature(): void {
    this.runBulk('feature');
  }

  protected bulkUnfeature(): void {
    this.runBulk('unfeature');
  }

  protected bulkTrash(): void {
    this.runBulk('trash');
  }

  private runBulk(kind: 'enable' | 'disable' | 'feature' | 'unfeature' | 'trash'): void {
    const ids = [...this.selectedIds()];
    const slugs = this.items().filter((p) => ids.includes(p.id)).map((p) => p.slug);
    if (slugs.length === 0) return;

    this.bulkBusy.set(true);
    this.bulkErrors.set([]);
    this.bulkProgress.set({ done: 0, total: slugs.length });
    const errors: string[] = [];

    const step = (index: number): void => {
      if (index >= slugs.length) {
        this.bulkProgress.set(null);
        this.bulkBusy.set(false);
        this.bulkErrors.set(errors);
        this.selectedIds.set(new Set());
        this.load();
        return;
      }

      this.bulkRequest(kind, slugs[index]).subscribe({
        next: () => {
          this.bulkProgress.set({ done: index + 1, total: slugs.length });
          step(index + 1);
        },
        error: (err) => {
          errors.push(`${slugs[index]}: ${err?.error?.message ?? 'request failed'}`);
          this.bulkProgress.set({ done: index + 1, total: slugs.length });
          step(index + 1);
        },
      });
    };

    step(0);
  }

  private bulkRequest(
    kind: 'enable' | 'disable' | 'feature' | 'unfeature' | 'trash',
    slug: string,
  ): Observable<unknown> {
    switch (kind) {
      case 'enable':
        return this.productService.toggleActive(slug, true);
      case 'disable':
        return this.productService.toggleActive(slug, false);
      case 'feature':
        return this.productService.toggleFeatured(slug, true);
      case 'unfeature':
        return this.productService.toggleFeatured(slug, false);
      case 'trash':
        return this.productService.delete(slug);
    }
  }

  onMenuAction(event: { id: string; item: ProductListItem }): void {
    switch (event.id) {
      case 'edit':
        this.goToEdit(event.item);
        break;
      case 'duplicate':
        this.duplicateProduct(event.item);
        break;
      case 'view':
        window.open(`/products/${event.item.slug}`, '_blank');
        break;
      case 'toggleActive':
        this.onToggleStatus(event.item);
        break;
      case 'toggleFeatured':
        this.onFeaturedToggle(event.item);
        break;
      case 'trash':
        this.trashProduct(event.item);
        break;
    }
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.syncUrl(true);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.syncUrl(true);
  }

  onSortChange(event: TableSortEvent | null): void {
    const col = event?.column ?? 'createdAt';
    // Map column IDs to sort fields
    const sortFieldMap: Record<string, string> = {
      productPrice: 'minPrice',
      main_en: 'name',
      product: 'name',
      updatedAt: 'updatedAt',
    };
    this.currentSort = sortFieldMap[col] || col;
    this.currentDirection = event?.direction ?? 'desc';
    this.currentPage.set(0);
    this.syncUrl(true);
  }

  goToCreate(): void {
    this.router.navigate(['/dashboard/products/new']);
  }

  goToEdit(product: ProductListItem): void {
    this.router.navigate(['/dashboard/products', product.slug, 'edit']);
  }

  toggleActive(product: ProductListItem): void {
    this.productService.toggleActive(product.slug, !product.isActive).subscribe({
      next: () => this.load(),
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not change status'),
    });
  }

  toggleFeatured(product: ProductListItem): void {
    this.onFeaturedToggle(product);
  }

  /** Optimistic star: flip immediately, roll back and toast if the API rejects it. */
  onFeaturedToggle(product: ProductListItem): void {
    const previous = this.items();
    const next = !product.featured;
    this.items.update((list) =>
      list.map((item) => (item.id === product.id ? { ...item, featured: next } : item)),
    );

    this.productService.toggleFeatured(product.slug, next).subscribe({
      error: (err) => {
        this.items.set(previous);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not update featured');
      },
    });
  }

  async onToggleStatus(product: ProductListItem): Promise<void> {
    const newActive = !product.isActive;
    if (!newActive && product.featured) {
      if (!(await this.confirmDialog.confirm({ title: 'Disable featured product', message: 'This product is featured. Disabling it will hide it from the storefront. Continue?', tone: 'destructive' }))) {
        return;
      }
    }
    this.productService.toggleActive(product.slug, newActive).subscribe({
      next: () => this.load(),
      error: (err) => this.notify.apiError(err, 'notify.errorFallback', 'Could not update status'),
    });
  }
}
