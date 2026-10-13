import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DataTableComponent,
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
  private router = inject(Router);

  protected readonly Math = Math;

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

  readonly totalItems = computed(() => this.pageData()?.totalElements ?? 0);

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
    this.filters.valueChanges.subscribe(() => {
      this.currentPage.set(0);
      this.load();
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const f = this.filters.value;
    const params: ProductListParams = {
      page: this.currentPage(),
      search: f.search || undefined,
      isActive: f.status === 'all' ? undefined : f.status === 'active',
      featured: f.featured === 'all' ? undefined : f.featured === 'featured',
      sort: this.currentSort,
      direction: this.currentDirection,
    };

    this.productService.getAll(params).subscribe({
      next: (res) => {
        this.items.set(res.data.content);
        this.pageData.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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
    });
  }

  toggleFeatured(product: ProductListItem): void {
    this.productService.toggleFeatured(product.slug, !product.featured).subscribe({
      next: () => this.load(),
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
      },
      error: () => this.submitting.set(false),
    });
  }
}
