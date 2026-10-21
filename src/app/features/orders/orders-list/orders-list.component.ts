import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideChevronLeft,
  lucideChevronRight,
  lucidePackage,
  lucideCheck,
} from '@ng-icons/lucide';
import { PageResponse } from '../../../core/models/api-response.model';
import { OrderResponse } from '../models/order.model';
import { OrderService } from '../services/order.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { DashboardStatsService } from '../../dashboard/services/dashboard-stats.service';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { ViewMode } from '../../../core/crud/base-list.component';

import { TranslocoPipe } from '@jsverse/transloco';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { NotifyService } from '../../../core/notify/notify.service';
@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [
    PagerComponent,
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
      lucideCheck,
    }),
  ],
  templateUrl: './orders-list.component.html',
})
export class OrdersListComponent {
  private orderService = inject(OrderService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected readonly language = inject(LanguageService);
  protected readonly stats = inject(DashboardStatsService);

  protected readonly Math = Math;

  items = signal<OrderResponse[]>([]);
  loading = signal(false);
  pageData = signal<PageResponse<OrderResponse> | null>(null);
  currentPage = signal(0);
  pageSize = signal(20);
  readonly pageSizeOptions = [10, 20, 50] as const;
  currentSort = 'createdAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  searchQuery = '';
  statusFilter = signal<string>('ALL');
  private searchTimeout: any;

  viewMode = signal<ViewMode>('list');

  readonly totalItems = computed(() => this.pageData()?.totalElements ?? 0);

  private columnHelper = createColumnHelper<OrderResponse>();
  columns: ColumnDef<OrderResponse, any>[] = [
    this.columnHelper.accessor('id', { header: 'ID', enableSorting: true }),
    this.columnHelper.accessor('items', { id: 'items', header: 'Items', enableSorting: false }),
    this.columnHelper.accessor(
      (row) => this.getOrderStatus(row.status),
      { id: 'status', header: 'Status', enableSorting: true },
    ),
    this.columnHelper.accessor('totalAmount', { header: 'Total', enableSorting: true, meta: { width: '140px' } }),
    this.columnHelper.accessor(
      (row) => this.paymentStatusLabel(row.paymentStatus),
      { id: 'paymentStatus', header: 'Payment', enableSorting: true },
    ),
    this.columnHelper.accessor(
      (row) => this.paymentMethodLabel(row.paymentMethod),
      { id: 'paymentMethod', header: 'Method', enableSorting: false },
    ),
    this.columnHelper.accessor('createdAt', { header: 'Created', enableSorting: true }),
    this.columnHelper.display({ id: 'actions', header: 'Actions' }),
  ];

  constructor() {
    // The dashboard's drill-down links here with a pre-filter, e.g.
    // /dashboard/orders?status=PENDING. The filter is read from the URL so
    // the link is shareable and survives a refresh.
    const status = this.route.snapshot.queryParamMap.get('status');
    if (status && status !== 'ALL') {
      this.statusFilter.set(status.toUpperCase());
    }
    this.loadPage();
  }

  loadPage(): void {
    this.loading.set(true);
    this.orderService
      .getAll({
        page: this.currentPage(),
        size: this.pageSize(),
        sort: this.currentSort,
        direction: this.currentDirection,
        status: this.statusFilter() === 'ALL' ? undefined : (this.statusFilter() as any),
        search: this.searchQuery || undefined,
      })
      .subscribe({
        next: (res) => {
          this.pageData.set(res.data);
          this.items.set(res.data.content);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not load orders');
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

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadPage();
  }

  onPageSizeChange(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.loadPage();
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
    this.currentPage.set(0);
    this.loadPage();
  }

  statusCount(status: string): number {
    return this.stats.statusChartData().find((s: any) => s.status === status)?.count ?? 0;
  }

  paymentStatusLabel(status: OrderResponse['paymentStatus']): string {
    const map: Record<string, string> = { PENDING: 'Pending', PAID: 'Paid', FAILED: 'Failed', REFUNDED: 'Refunded' };
    return map[status] ?? status;
  }

  paymentMethodLabel(method: OrderResponse['paymentMethod']): string {
    return method === 'ONLINE' ? 'Online' : method === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : method;
  }

  getOrderStatus(status: OrderResponse['status']): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' } {
    switch (status) {
      case 'PENDING':
        return { label: 'Pending', variant: 'warning' };
      case 'CONFIRMED':
        return { label: 'Confirmed', variant: 'default' };
      case 'PROCESSING':
        return { label: 'Processing', variant: 'secondary' };
      case 'SHIPPED':
        return { label: 'Shipped', variant: 'default' };
      case 'DELIVERED':
        return { label: 'Delivered', variant: 'default' };
      case 'CANCELLED':
        return { label: 'Cancelled', variant: 'destructive' };
      default:
        return { label: status, variant: 'outline' };
    }
  }

  totalOrders(): number {
    return this.stats.statusChartData().reduce((a: number, b: any) => a + (b.count ?? 0), 0);
  }

  openView(order: OrderResponse): void {
    // The order's own page, not an overlay: one order view, reachable by URL
    // (reloadable, linkable). `OrderDetailComponent` was unreachable before —
    // nothing ever emitted `rowClick` here.
    this.router.navigate(['/dashboard/orders', order.id]);
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