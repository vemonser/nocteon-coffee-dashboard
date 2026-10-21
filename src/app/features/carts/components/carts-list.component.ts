import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideChevronLeft,
  lucideChevronRight,
  lucideShoppingCart,
  lucidePackage,
  lucideX,
} from '@ng-icons/lucide';
import { PageResponse } from '../../../core/models/api-response.model';
import { CartItemResponse, CartResponse } from '../models/cart.model';
import { CartService } from '../services/cart.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { ViewMode } from '../../../core/crud/base-list.component';
import { NotifyService } from '../../../core/notify/notify.service';

import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
@Component({
  selector: 'app-carts-list',
  standalone: true,
  imports: [
    PagerComponent,
    CommonModule,
    FormsModule,
    DataTableComponent,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmTableImports,
    HlmSkeletonImports,
    NgIcon,
    TranslocoPipe,
    MoneyPipe,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideChevronLeft,
      lucideChevronRight,
      lucideShoppingCart,
      lucidePackage,
      lucideX,
    }),
  ],
  templateUrl: './carts-list.component.html',
})

export class CartsListComponent {
  private notify = inject(NotifyService);
  private cartService = inject(CartService);
  protected readonly language = inject(LanguageService);

  protected readonly Math = Math;

  items = signal<CartResponse[]>([]);
  loading = signal(false);
  pageData = signal<PageResponse<CartResponse> | null>(null);
  currentPage = signal(0);
  pageSize = signal(20);
  readonly pageSizeOptions = [10, 20, 50] as const;
  currentSort = 'createdAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  searchQuery = '';
  private searchTimeout: any;

  viewing = signal<CartResponse | null>(null);
  viewMode = signal<ViewMode>('list');

  readonly totalItems = computed(() => this.pageData()?.totalElements ?? 0);

  private columnHelper = createColumnHelper<CartResponse>();
  columns: ColumnDef<CartResponse, any>[] = [
    this.columnHelper.accessor('id', { header: 'ID', enableSorting: true }),
    this.columnHelper.accessor('userFullName', { header: 'Customer', enableSorting: true }),
    this.columnHelper.accessor('userEmail', { header: 'Email', enableSorting: false, meta: { width: '220px' } }),
    this.columnHelper.accessor('items', { id: 'items', header: 'Items', enableSorting: false }),
    this.columnHelper.accessor('itemCount', { header: 'Count', enableSorting: false }),
    this.columnHelper.accessor('total', { header: 'Total', enableSorting: true, meta: { width: '140px' } }),
    this.columnHelper.accessor('createdAt', { header: 'Created', enableSorting: true }),
    this.columnHelper.display({ id: 'actions', header: 'Actions' }),
  ];

  constructor() {
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    this.cartService
      .getAll({
        page: this.currentPage(),
        size: this.pageSize(),
        search: this.searchQuery || undefined,
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .subscribe({
        next: (res) => {
          this.pageData.set(res.data)
          this.items.set(res.data.content)
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not load carts');
        },
      });
  }

  onSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(0);
      this.loadPage();
    }, 400);
  }

  onPageSizeChange(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.loadPage();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadPage();
  }

  openView(cart: CartResponse): void {
    this.viewing.set(cart);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  onSortChange(event: { column: string; direction: 'asc' | 'desc' } | null): void {
    this.currentSort = event?.column ?? 'createdAt';
    this.currentDirection = event?.direction ?? 'desc';
    this.currentPage.set(0);
    this.loadPage();
  }
}