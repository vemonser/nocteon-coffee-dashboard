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
} from '@ng-icons/lucide';
import { PageResponse } from '../../../../core/models/api-response.model';
import { ProductListItem, ProductListParams } from '../../models/product.models';
import { ProductService } from '../../services/product.service';
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
    }),
  ],
  templateUrl: './products-list.component.html',
})
export class ProductsListComponent {
  private productService = inject(ProductService);
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

  currentSort = 'createdAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  private searchTimeout: any;

  readonly filters = new FormGroup({
    search: new FormControl(''),
    status: new FormControl('all'),
    featured: new FormControl('all'),
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
    this.columnHelper.accessor((row): string => `${row.minPrice} - ${row.maxPrice}`, {
      id: 'priceRange',
      header: 'Price Range',
      enableSorting: false,
    }),
    this.columnHelper.accessor('isActive', { header: 'Status', enableSorting: false }),
    this.columnHelper.accessor('featured', { header: 'Featured', enableSorting: false }),
    this.columnHelper.display({ id: 'actions', header: 'Actions' }),
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
      search: f.search || undefined,
      categorySlug: this.categorySlug() ?? undefined,
      isActive: f.status === 'all' ? undefined : f.status === 'active',
      featured: f.featured === 'all' ? undefined : f.featured === 'featured',
      sort: this.currentSort,
      direction: this.currentDirection,
    };

    this.productService.getAll(params).subscribe({
      next: (res) => {
        this.items.set(res.data.content);
        this.pageData.set(res.data);
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
      search: this.filters.value.search || undefined,
      sort: this.currentSort,
      direction: this.currentDirection,
    };
    this.productService.getDeleted(params).subscribe({
      next: (res: any) => {
        const mapped: ProductListItem[] = (res.data.content ?? []).map((p: any) => ({
          id: p.id,
          name: p.name ?? (p.translations?.find((t: any) => t.language === 'en')?.name ?? ''),
          slug: p.slug,
          primaryImageUrl: p.primaryImageUrl ?? p.imageUrl ?? null,
          minPrice: p.minPrice ?? 0,
          maxPrice: p.maxPrice ?? 0,
          isActive: p.isActive ?? false,
          featured: p.featured ?? false,
        }));
        this.items.set(mapped);
        this.pageData.set({ ...res.data, content: mapped } as any);
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

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.load();
  }

  onSortChange(event: TableSortEvent | null): void {
    this.currentSort = event?.column ?? 'createdAt';
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

  confirmDelete(product: ProductListItem): void {
    this.deleting.set(product);
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
