import { Component, inject, OnInit, signal } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { Router } from '@angular/router';
import { ProductListItem, ProductListParams } from '../../models/product.models';
import { PageResponse } from '../../../../core/models/api-response.model';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { DataTableComponent, TableSortEvent } from '../../../../shared/components/data-table/data-table.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../../core/auth/permission.directive';

@Component({
  selector: 'app-products-list',
  imports: [CommonModule, FormsModule, HasPermissionDirective, DataTableComponent],
  templateUrl: './products-list.component.html',
  styleUrl: './products-list.component.css',
})
export class ProductsListComponent implements OnInit {
  private productService = inject(ProductService);
  private router = inject(Router);
  protected Math = Math;

  // ─── State ────────────────────────────────────────────────────────────────────
  items = signal<ProductListItem[]>([]);
  pageData = signal<PageResponse<ProductListItem> | null>(null);
  loading = signal(false);
  deleting = signal<ProductListItem | null>(null);
  submitting = signal(false);
  currentPage = signal(0);

  searchQuery = '';
  isActiveFilter: boolean | undefined = undefined;
  featuredFilter: boolean | undefined = undefined;
  currentSort = 'createdAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  private searchTimeout: any;

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

  ngOnInit(): void {
    this.load();
  }
  // ─── Data ────────────────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    const params: ProductListParams = {
      page: this.currentPage(),
      search: this.searchQuery || undefined,
      isActive: this.isActiveFilter,
      featured: this.featuredFilter,
      sort: this.currentSort,
      direction: this.currentDirection,
    };

    this.productService.getAll(params).subscribe({
      next: (res) => {
        console.log(res.data.content)
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

  onFilterChange(): void {
    this.currentPage.set(0);
    this.load();
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
  // ─── Navigation — wizard lives at its own route ───────────────────────────────

  goToCreate(): void {
    this.router.navigate(['/dashboard/products/new']);
  }

  goToEdit(product: ProductListItem): void {
    this.router.navigate(['/dashboard/products', product.slug, 'edit']);
  }

  // ─── Quick toggles — cheap PATCH, no full reload of detail needed ─────────────

  toggleActive(product: ProductListItem): void {
    const next = !product.isActive;
    this.productService.toggleActive(product.slug, next).subscribe({
      next: () => this.load(),
    });
  }

  toggleFeatured(product: ProductListItem): void {
    const next = !product.featured;
    this.productService.toggleFeatured(product.slug, next).subscribe({
      next: () => this.load(),
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

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
