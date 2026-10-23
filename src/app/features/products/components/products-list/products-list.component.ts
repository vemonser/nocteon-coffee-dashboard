import { Component, computed, inject, signal } from '@angular/core';
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
import { CategoryTranslationService } from '../../../../shared/services/category-translation.service';
import { HasPermissionDirective } from '../../../../core/auth/permission.directive';
import { AuthService } from '../../../../core/auth/auth.service';
import { LifecycleTabsComponent } from '../../../../shared/components/lifecycle-tabs/lifecycle-tabs.component';
import { TrashBannerComponent } from '../../../../shared/components/trash-banner/trash-banner.component';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PagerComponent } from '../../../../shared/components/pager/pager.component';
import { NotifyService } from '../../../../core/notify/notify.service';

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
  deleting = signal<ProductListItem | null>(null);
  submitting = signal(false);
  currentPage = signal(0);
  pageSize = signal(20);
  selectedIds = signal<ReadonlySet<number>>(new Set());

  currentSort = 'createdAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  private searchTimeout: any;

  readonly filters = new FormGroup({
    search: new FormControl(''),
    status: new FormControl('all'),
    featured: new FormControl('all'),
    type: new FormControl('all'),
  });

  readonly loadError = signal(false);

  readonly totalItems = computed(() => this.pageData()?.totalElements ?? 0);
  readonly activeCount = signal(0);
  readonly trashCount = signal(0);

  private columnHelper = createColumnHelper<ProductListItem>();
  columns: ColumnDef<ProductListItem, any>[] = [
    this.columnHelper.accessor('primaryImageUrl', { id: 'image', header: 'Image', enableSorting: false }),
    this.columnHelper.accessor('name', { header: 'Name', enableSorting: true }),
    this.columnHelper.accessor('slug', { header: 'Slug', enableSorting: true }),
    this.columnHelper.accessor((row) => {
      // Display translated product type name instead of raw value
      const typeLabels: Record<ProductType, string> = {
        'COFFEE': 'Coffee',
        'EQUIPMENT': 'Equipment',
      };
      return typeLabels[row.productType] || row.productType;
    }, { header: 'Type', enableSorting: false }),
    this.columnHelper.accessor((row) => {
      // Display translated category name instead of raw slug
      return row.categoryName || row.categorySlug;
    }, { header: 'Category', enableSorting: false, id: 'category' }),
    this.columnHelper.accessor((row): string => {
      const min = row.minPrice;
      const max = row.maxPrice;
      const fmt = (n: number) => `EGP ${n.toLocaleString('en-US')}`;
      if (min === max) return fmt(min);
      return `${fmt(min)} – ${fmt(max)}`;
    }, {
      id: 'priceRange',
      header: 'Price Range',
      enableSorting: true,
    }),
    this.columnHelper.accessor('isActive', { header: 'Status', enableSorting: false }),
    this.columnHelper.accessor('featured', { header: 'Featured', enableSorting: false }),
    this.columnHelper.display({ id: 'actions', header: 'Actions' }),
  ];

  protected readonly menuActions: any[] = [
    { id: 'duplicate', label: 'products.actions.duplicate', icon: 'lucideCopy' },
    { id: 'view', label: 'products.actions.viewOnStorefront', icon: 'lucideExternalLink' },
    { id: 'trash', label: 'products.actions.moveToTrash', icon: 'lucideTrash2', danger: true },
  ];

  constructor() {
    this.categorySlug.set(this.route.snapshot.queryParamMap.get('category'));
    // The dashboard's low-stock drill-down asks for the low-stock set.
    this.lowStockOnly.set(this.route.snapshot.queryParamMap.get('stock') === 'low');
    this.filters.valueChanges.subscribe(() => {
      this.currentPage.set(0);
      this.load();
    });
    this.load();
  }

  clearCategoryFilter(): void {
    this.categorySlug.set(null);
    this.currentPage.set(0);
    this.router.navigate([], { queryParams: {}, relativeTo: this.route });
    this.load();
  }

  setListView(mode: 'active' | 'trash'): void {
    this.viewMode.set(mode);
    this.currentPage.set(0);
    this.load();
  }

  load(): void {
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
      isActive: f.status === 'all' ? undefined : f.status === 'active',
      featured: f.featured === 'all' ? undefined : f.featured === 'featured',
      productType: f.type === 'all' ? undefined : (f.type as ProductType),
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
          isActive: p.isActive !== undefined ? p.isActive : true,  // Fix: default to true if undefined
          name: p.name ?? (p.translations?.find((t: any) => t.language === 'en')?.name ?? ''),
          shortDescription: p.shortDescription ?? null,
          primaryImageUrl: p.primaryImageUrl ?? p.imageUrl ?? null,
          minPrice: p.minPrice ?? 0,
          maxPrice: p.maxPrice ?? 0,
          discountPercentage: p.discountPercentage ?? null,
        }));

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
          isActive: p.isActive !== undefined ? p.isActive : true,
          featured: p.featured ?? false,
        }));

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

  restore(product: ProductListItem): void {
    this.productService.restore(product.id).subscribe({
      next: () => {
        this.load();
        this.notify.success('notify.restored', 'Restored successfully');
      },
      error: (err) => this.notify.apiError(err, 'notify.errorFallback', 'Could not restore'),
    });
  }

  openPermanentDelete(product: ProductListItem): void {
    this.deleting.set(product);
  }

  submitDeleteOrPermanent(): void {
    if (this.isTrash()) {
      this.submitPermanentDelete();
    } else {
      this.submitDelete();
    }
  }

  submitPermanentDelete(): void {
    const product = this.deleting();
    if (!product) return;
    this.submitting.set(true);
    this.productService.deletePermanently(product.id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.load();
        this.submitting.set(false);
        this.notify.success('notify.deleted', 'Deleted permanently');
      },
      error: (err) => {
        this.submitting.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not delete permanently');
      },
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
    const ids = [...this.selectedIds()];
    const slugs = this.items().filter((p) => ids.includes(p.id)).map((p) => p.slug);
    slugs.forEach((slug) => this.productService.toggleActive(slug, true).subscribe({ next: () => this.load() }));
  }

  protected bulkDisable(): void {
    const ids = [...this.selectedIds()];
    const slugs = this.items().filter((p) => ids.includes(p.id)).map((p) => p.slug);
    slugs.forEach((slug) => this.productService.toggleActive(slug, false).subscribe({ next: () => this.load() }));
  }

  protected bulkTrash(): void {
    const ids = [...this.selectedIds()];
    const slugs = this.items().filter((p) => ids.includes(p.id)).map((p) => p.slug);
    slugs.forEach((slug) => this.productService.delete(slug).subscribe({ next: () => this.load() }));
  }

  onMenuAction(event: { id: string; item: any }): void {
    if (event.id === 'duplicate') {
      this.router.navigate(['/dashboard/products', event.item.slug, 'duplicate']);
    } else if (event.id === 'view') {
      window.open(`/products/${event.item.slug}`, '_blank');
    } else if (event.id === 'trash') {
      this.confirmDelete(event.item);
    }
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.load();
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.load();
  }

  onSortChange(event: TableSortEvent | null): void {
    const col = event?.column ?? 'createdAt';
    // Map column IDs to sort fields
    const sortFieldMap: Record<string, string> = {
      'priceRange': 'minPrice',
      'product': 'name',
      'updatedAt': 'updatedAt',
    };
    this.currentSort = sortFieldMap[col] || col;
    this.currentDirection = event?.direction ?? 'desc';
    this.currentPage.set(0);
    this.load();
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
    this.productService.toggleFeatured(product.slug, !product.featured).subscribe({
      next: () => this.load(),
      error: (err) =>
        this.notify.apiError(err, 'notify.errorFallback', 'Could not update featured'),
    });
  }

  onFeaturedToggle(product: ProductListItem): void {
    this.productService.toggleFeatured(product.slug, !product.featured).subscribe({
      next: () => this.load(),
      error: (err) => this.notify.apiError(err, 'notify.errorFallback', 'Could not update featured'),
    });
  }

  confirmDelete(product: ProductListItem): void {
    this.deleting.set(product);
  }

  onToggleStatus(product: ProductListItem): void {
    const newActive = !product.isActive;
    if (!newActive && product.featured) {
      if (!window.confirm('This product is featured. Disabling it will hide it from the storefront. Continue?')) {
        return;
      }
    }
    this.productService.toggleActive(product.slug, newActive).subscribe({
      next: () => this.load(),
      error: (err) => this.notify.apiError(err, 'notify.errorFallback', 'Could not update status'),
    });
  }

  submitDelete(): void {
    const product = this.deleting();
    if (!product) return;
    this.submitting.set(true);

    this.productService.delete(product.slug).subscribe({
      next: () => {
        this.deleting.set(null);
        this.load();
        this.submitting.set(false);
        this.notify.success('notify.deleted', 'Deleted successfully');
      },
      error: (err) => {
        this.submitting.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not delete');
      },
    });
  }
}
