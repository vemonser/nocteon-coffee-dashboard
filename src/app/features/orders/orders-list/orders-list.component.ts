import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideChevronLeft,
  lucideChevronRight,
  lucidePackage,
  lucideX,
  lucideCheck,
} from '@ng-icons/lucide';
import { PageResponse } from '../../../core/models/api-response.model';
import { OrderResponse, OrderStatus } from '../models/order.model';
import { OrderService } from '../services/order.service';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { ViewMode } from '../../../core/crud/base-list.component';

import { TranslocoPipe } from '@jsverse/transloco';
@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DataTableComponent,
    HlmButtonImports,
    HlmInputImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideChevronLeft,
      lucideChevronRight,
      lucidePackage,
      lucideX,
      lucideCheck,
    }),
  ],
  templateUrl: './orders-list.component.html',
})
export class OrdersListComponent {
  private orderService = inject(OrderService);

  protected readonly Math = Math;

  readonly statuses: { label: string; value: OrderStatus }[] = [
    { label: 'PENDING', value: 'PENDING' },
    { label: 'CONFIRMED', value: 'CONFIRMED' },
    { label: 'PROCESSING', value: 'PROCESSING' },
    { label: 'SHIPPED', value: 'SHIPPED' },
    { label: 'DELIVERED', value: 'DELIVERED' },
    { label: 'CANCELLED', value: 'CANCELLED' },
  ];

  readonly statusColors: Record<OrderStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    PROCESSING: 'bg-purple-100 text-purple-700',
    SHIPPED: 'bg-indigo-100 text-indigo-700',
    DELIVERED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  readonly paymentStatusColors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700',
    PAID: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    REFUNDED: 'bg-gray-100 text-gray-700',
  };

  items = signal<OrderResponse[]>([]);
  loading = signal(false);
  pageData = signal<PageResponse<OrderResponse> | null>(null);
  currentPage = signal(0);
  currentSort = 'createdAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  searchQuery = '';
  private searchTimeout: any;

  viewing = signal<OrderResponse | null>(null);
  updatingStatus = signal(false);
  viewMode = signal<ViewMode>('list');

  readonly totalItems = computed(() => this.pageData()?.totalElements ?? 0);

  private columnHelper = createColumnHelper<OrderResponse>();
  columns: ColumnDef<OrderResponse, any>[] = [
    this.columnHelper.accessor('id', { header: 'ID', enableSorting: true }),
    this.columnHelper.accessor('status', { header: 'Status', enableSorting: true }),
    this.columnHelper.accessor('totalAmount', { header: 'Total', enableSorting: true }),
    this.columnHelper.accessor('paymentStatus', { header: 'Payment', enableSorting: true }),
    this.columnHelper.accessor('paymentMethod', { header: 'Method', enableSorting: false }),
    this.columnHelper.accessor('createdAt', { header: 'Created', enableSorting: true }),
    this.columnHelper.display({ id: 'actions', header: 'Actions' }),
  ];

  constructor() {
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    this.orderService
      .getAll({
        page: this.currentPage(),
        sort: this.currentSort,
        direction: this.currentDirection,
      })
      .subscribe({
        next: (res) => {
          this.pageData.set(res.data);
          this.items.set(res.data.content);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(0);
      this.loadPage();
    }, 400);
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadPage();
  }

  openView(order: OrderResponse): void {
    this.viewing.set(order);
  }

  closeView(): void {
    this.viewing.set(null);
  }

  updateStatus(order: OrderResponse, newStatus: OrderStatus): void {
    if (order.status === newStatus) return;
    this.updatingStatus.set(true);
    this.orderService.updateStatus(order.id, newStatus).subscribe({
      next: (res) => {
        this.updatingStatus.set(false);
        this.viewing.set(res.data);
        this.loadPage();
      },
      error: () => this.updatingStatus.set(false),
    });
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