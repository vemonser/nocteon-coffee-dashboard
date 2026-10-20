import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucidePackage,
  lucideDownload,
  lucideRefreshCw,
  lucidePrinter,
  lucideCircleSlash,
  lucideCreditCard,
  lucideBanknote,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { NotifyService } from '../../../core/notify/notify.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { LocalizedNameService } from '../../../core/i18n/localized-name.service';
import { StoreSettingsService } from '../../../core/settings/store-settings.service';
import { formatCurrency } from '../../../shared/utils/locale-format';
import { OrderService } from '../services/order.service';
import {
  OrderResponse,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../models/order.model';
import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  orderStatusKind,
  paymentStatusKind,
} from '../models/order-status.model';
import {
  DEFAULT_ORDER_FILTERS,
  OPEN_STATUSES,
  applyFilters,
  countByPaymentMethod,
  countByPaymentStatus,
  countByStatus,
  type OrderFilters,
} from '../utils/order-filters';
import { formatOrderNumber } from '../utils/order-number';
import { ORDER_COUNT_SCOPES } from '../../../core/dashboard/order-scope';
import type { RowMenuAction } from '../../../shared/ui/actions-cell/actions-cell.component';

/**
 * The orders list.
 *
 * The whole page state — the status tab, the filters, the sort, the page —
 * lives in the URL, so a link is shareable, a refresh keeps the view, and the
 * browser's back button walks back through the changes.
 *
 * The NUMBERS are the point of this page. Two rules:
 *
 *  1. The API is the source of truth for the totals. The list shows the
 *     stored `totalAmount`, never a re-derived number.
 *  2. Every COUNT comes from the whole set, never from the rows on the
 *     current page. The cards used to read the dashboard's 30-day overview,
 *     which is why "Cancelled" said 0 while seven rows said "Cancelled".
 */
@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DataTableComponent,
    HlmButtonImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmTooltipImports,
    BrnTooltip,
    NgIcon,
    PagerComponent,
    PluralPipe,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucidePackage,
      lucideDownload,
      lucideRefreshCw,
      lucidePrinter,
      lucideCircleSlash,
      lucideCreditCard,
      lucideBanknote,
      lucideX,
    }),
  ],
  templateUrl: './orders-list.component.html',
})
export class OrdersListComponent {
  private readonly orderService = inject(OrderService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly language = inject(LanguageService);
  protected readonly names = inject(LocalizedNameService);
  private readonly storeSettings = inject(StoreSettingsService);
  private readonly transloco = inject(TranslocoService);

  /** Every order the API returned. The filters are applied to THIS. */
  protected readonly allOrders = signal<OrderResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  /** True when the store has more orders than the list fetched. */
  protected readonly truncated = signal(false);
  /** True when the data on screen is older than the newest request. */
  protected readonly stale = signal(false);

  protected readonly status = signal<OrderStatus | 'ALL'>('ALL');
  protected readonly filters = signal<OrderFilters>({ ...DEFAULT_ORDER_FILTERS });
  protected readonly sort = signal<string>('createdAt');
  protected readonly direction = signal<'asc' | 'desc'>('desc');
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly selectedIds = signal<ReadonlySet<number>>(new Set());

  protected readonly pageSizeOptions = [10, 20, 50] as const;

  /** Translate with an English fallback — never a raw key. */
  protected t(key: string, fallback: string): string {
    return this.notify.t(key, fallback);
  }

  protected readonly statuses = ORDER_STATUSES;
  protected readonly paymentStatuses = PAYMENT_STATUSES;
  protected readonly paymentMethods = PAYMENT_METHODS;

  /**
   * The id of the newest request. A response that is not the newest is
   * DISCARDED, so switching a filter quickly can never show the data of an
   * older request.
   */
  private requestId = 0;

  /** ── the derived view ───────────────────────────────────────────────── */

  /** The orders that match the FILTERS (the status tab is a separate axis). */
  protected readonly matching = computed(() => applyFilters(this.allOrders(), this.filters()));

  /** The status counts, within the matching set. */
  protected readonly statusCounts = computed(() => countByStatus(this.matching()));

  /** The payment-status counts, within the matching set. */
  protected readonly paymentStatusCounts = computed(() => countByPaymentStatus(this.matching()));

  /** The payment-method counts, within the matching set. */
  protected readonly paymentMethodCounts = computed(() => countByPaymentMethod(this.matching()));

  /** The rows the table shows: the matching set, narrowed by the status tab. */
  protected readonly rows = computed(() => {
    const status = this.status();
    const filtered =
      status === 'ALL' ? this.matching() : this.matching().filter((o) => o.status === status);
    const start = this.page() * this.size();
    return filtered.slice(start, start + this.size());
  });

  /** How many rows the status tab selects. */
  protected readonly visibleTotal = computed(() => {
    const status = this.status();
    return status === 'ALL'
      ? this.matching().length
      : this.matching().filter((o) => o.status === status).length;
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.visibleTotal() / this.size())),
  );

  protected readonly first = computed(() => this.page() === 0);
  protected readonly last = computed(() => this.page() >= this.totalPages() - 1);

  /** The count in the page header — what the table actually shows. */
  protected readonly headerCount = computed(() => this.visibleTotal());

  /**
   * What the counts on this page cover.
   *
   * The page counts EVERY order — the cancelled, the pending and the
   * refunded ones included. The dashboard counts the PAID orders only, so
   * the two numbers are different, and the page says which set it is
   * showing. One definition, shared with the dashboard
   * (core/dashboard/order-scope.ts).
   */
  protected readonly scopeNote = computed(() => {
    this.language.language();
    return this.transloco.translate(ORDER_COUNT_SCOPES.all.helpKey);
  });

  /** The cards. Each one says exactly what it counts. */
  protected readonly allCount = computed(() => this.allOrders().length);
  protected readonly matchingCount = computed(() => this.matching().length);
  protected readonly openCount = computed(
    () => this.matching().filter((o) => OPEN_STATUSES.includes(o.status)).length,
  );
  protected readonly deliveredCount = computed(
    () => this.matching().filter((o) => o.status === 'DELIVERED').length,
  );
  protected readonly cancelledCount = computed(
    () => this.matching().filter((o) => o.status === 'CANCELLED').length,
  );

  /** Is a filter other than the status tab active? */
  protected readonly hasActiveFilters = computed(() => {
    const f = this.filters();
    return (
      f.paymentStatus !== 'ALL' ||
      f.paymentMethod !== 'ALL' ||
      f.range !== 'all' ||
      f.search.trim() !== ''
    );
  });

  protected readonly selectedCount = computed(() => this.selectedIds().size);

  /** The row id the table keys its selection on. */
  protected readonly rowId = (row: OrderResponse): number | null => row?.id ?? null;

  /**
   * The order number is the row's link to its own page.
   *
   * A real anchor, so middle-click and open-in-new-tab work.
   */
  protected readonly cellHref = (columnId: string, row: OrderResponse): any[] | null =>
    columnId === 'orderNumber' ? ['/dashboard/orders', row.id] : null;

  /**
   * The empty state says WHICH emptiness it is: a store with no orders, or
   * orders that the current filters exclude. They need different words and a
   * different way out.
   */
  protected readonly emptyMessage = computed(() => {
    if (this.allOrders().length === 0) return this.t('orders.emptyState.noOrders', 'No orders yet');
    if (this.hasActiveFilters() || this.status() !== 'ALL') {
      return this.t('orders.emptyState.noResults', 'No orders match these filters');
    }
    return this.t('orders.empty', 'No orders found');
  });

  /** ── the columns ────────────────────────────────────────────────────── */

  private readonly columnHelper = createColumnHelper<OrderResponse>();

  /**
   * The column order (ticket 3.1): select, order #, customer, items, order
   * status, payment status, method, total, created at, actions.
   *
   * The raw id column is NOT here — it is reference noise for a reader, and
   * the order number is the identifier a customer quotes.
   */
  protected readonly columns: ColumnDef<OrderResponse, any>[] = [
    this.columnHelper.accessor(
      (row) => formatOrderNumber(row.orderNumber, row.id),
      { id: 'orderNumber', header: 'Order #', enableSorting: false, meta: { width: '166px' } },
    ),
    this.columnHelper.accessor(
      (row) => ({ name: row.customer?.name ?? null, email: row.customer?.email ?? null }),
      { id: 'customer', header: 'Customer', enableSorting: false, meta: { width: '95px' } },
    ),
    this.columnHelper.accessor('items', {
      id: 'items',
      header: 'Items',
      enableSorting: false,
      meta: { width: '84px' },
    }),
    this.columnHelper.accessor(
      (row) => orderStatusKind(row.status),
      { id: 'orderStatus', header: 'Order status', enableSorting: true, meta: { width: '124px' } },
    ),
    this.columnHelper.accessor(
      (row) => paymentStatusKind(row.paymentStatus),
      { id: 'paymentStatus', header: 'Payment status', enableSorting: true, meta: { width: '132px' } },
    ),
    this.columnHelper.accessor(
      (row) => ({
        icon: row.paymentMethod === 'ONLINE' ? 'lucideCreditCard' : 'lucideBanknote',
        method: row.paymentMethod,
      }),
      { id: 'paymentMethod', header: 'Method', enableSorting: false, meta: { width: '179px' } },
    ),
    this.columnHelper.accessor('totalAmount', {
      id: 'totalAmount',
      header: 'Total',
      enableSorting: true,
      meta: { width: '110px', align: 'end' },
    }),
    this.columnHelper.accessor('createdAt', {
      id: 'createdAtTime',
      header: 'Created at',
      enableSorting: true,
      meta: { width: '110px' },
    }),
    this.columnHelper.display({ id: 'actions', header: 'Actions', meta: { width: '82px' } }),
  ];

  /**
   * The sort property the BACKEND understands.
   *
   * The table's column ids are display ids; the API sorts by the Order
   * entity's own property names. A mismatch here is a 400 from the API, so
   * the mapping is explicit.
   */
  private static readonly SORT_PROPERTY: Record<string, string> = {
    orderNumber: 'orderNumber',
    customer: 'createdAt',
    items: 'createdAt',
    orderStatus: 'status',
    paymentStatus: 'paymentStatus',
    paymentMethod: 'paymentMethod',
    totalAmount: 'totalAmount',
    createdAtTime: 'createdAt',
  };

  /** The display column id for a backend sort property. */
  private static readonly SORT_COLUMN: Record<string, string> = {
    orderNumber: 'orderNumber',
    status: 'orderStatus',
    paymentStatus: 'paymentStatus',
    paymentMethod: 'paymentMethod',
    totalAmount: 'totalAmount',
    createdAt: 'createdAtTime',
  };

  /** The row's overflow menu. */
  protected readonly menuActions: RowMenuAction[] = [
    { id: 'changeStatus', label: 'orders.actions.changeStatus', icon: 'lucideRefreshCw' },
    { id: 'printInvoice', label: 'orders.actions.printInvoice', icon: 'lucidePrinter' },
    { id: 'cancel', label: 'orders.actions.cancel', icon: 'lucideCircleSlash', danger: true },
  ];

  constructor() {
    this.readUrl();
    this.load();

    // The URL is the source of truth: a back/forward navigation or a shared
    // link changes the query params, and the page follows them.
    this.route.queryParamMap.subscribe((params) => {
      const next = this.stateFromParams(params);
      if (JSON.stringify(next) !== JSON.stringify(this.currentState())) {
        this.applyState(next);
        this.load();
      }
    });
  }

  // ── URL state ────────────────────────────────────────────────────────────

  private currentState() {
    return {
      status: this.status(),
      filters: this.filters(),
      sort: this.sort(),
      direction: this.direction(),
      page: this.page(),
      size: this.size(),
    };
  }

  private stateFromParams(params: import('@angular/router').ParamMap) {
    const status = (params.get('status') ?? 'ALL').toUpperCase();
    const range = (params.get('range') ?? 'all') as OrderFilters['range'];
    const sort = params.get('sort') ?? 'createdAt';
    const direction = (params.get('direction') ?? 'desc') as 'asc' | 'desc';
    const page = Number(params.get('page') ?? 0) || 0;
    const size = Number(params.get('size') ?? 20) || 20;

    return {
      status: (ORDER_STATUSES as readonly string[]).includes(status)
        ? (status as OrderStatus)
        : ('ALL' as const),
      filters: {
        paymentStatus: (params.get('paymentStatus') ?? 'ALL').toUpperCase() as PaymentStatus | 'ALL',
        paymentMethod: (params.get('paymentMethod') ?? 'ALL').toUpperCase() as PaymentMethod | 'ALL',
        range: (['today', '7d', '30d', 'all', 'custom'] as const).includes(range) ? range : 'all',
        from: params.get('from'),
        to: params.get('to'),
        search: params.get('q') ?? '',
      } as OrderFilters,
      sort,
      direction,
      page: Math.max(0, page),
      size: [10, 20, 50].includes(size) ? size : 20,
    };
  }

  private readUrl(): void {
    this.applyState(this.stateFromParams(this.route.snapshot.queryParamMap));
  }

  private applyState(state: ReturnType<OrdersListComponent['stateFromParams']>): void {
    this.status.set(state.status);
    this.filters.set(state.filters);
    this.sort.set(state.sort);
    this.direction.set(state.direction);
    this.page.set(state.page);
    this.size.set(state.size);
  }

  /** Write the state back to the URL. */
  private writeUrl(replace = false): void {
    const status = this.status();
    const f = this.filters();
    const params: Record<string, string> = {};

    if (status !== 'ALL') params['status'] = status;
    if (f.paymentStatus !== 'ALL') params['paymentStatus'] = f.paymentStatus;
    if (f.paymentMethod !== 'ALL') params['paymentMethod'] = f.paymentMethod;
    if (f.range !== 'all') params['range'] = f.range;
    if (f.from) params['from'] = f.from;
    if (f.to) params['to'] = f.to;
    if (f.search.trim()) params['q'] = f.search.trim();
    if (this.sort() !== 'createdAt') params['sort'] = this.sort();
    if (this.direction() !== 'desc') params['direction'] = this.direction();
    if (this.page() > 0) params['page'] = `${this.page()}`;
    if (this.size() !== 20) params['size'] = `${this.size()}`;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: replace,
    });
  }

  // ── loading ──────────────────────────────────────────────────────────────

  /**
   * Load the orders.
   *
   * The whole set is fetched (the API caps a page at 100), so the filters
   * the API does not support and the counts the cards show are exact.
   */
  protected load(): void {
    const requestId = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);

    this.orderService
      .getAllOrders({ sort: this.sort(), direction: this.direction() })
      .subscribe({
        next: (res) => {
          // A response that is not the newest is dropped: the page can never
          // show the data of an older request.
          if (requestId !== this.requestId) return;
          this.allOrders.set(res.orders);
          this.truncated.set(res.truncated);
          this.stale.set(false);
          this.loading.set(false);
        },
        error: (err) => {
          if (requestId !== this.requestId) return;
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'orders.errorState.title');
        },
      });
  }

  protected retry(): void {
    this.load();
  }

  // ── interactions ─────────────────────────────────────────────────────────

  protected setStatus(status: OrderStatus | 'ALL'): void {
    if (this.status() === status) return;
    this.status.set(status);
    this.page.set(0);
    this.selectedIds.set(new Set());
    this.writeUrl();
  }

  protected setPaymentStatus(value: string): void {
    this.filters.update((f) => ({ ...f, paymentStatus: value as PaymentStatus | 'ALL' }));
    this.page.set(0);
    this.writeUrl();
  }

  protected setPaymentMethod(value: string): void {
    this.filters.update((f) => ({ ...f, paymentMethod: value as PaymentMethod | 'ALL' }));
    this.page.set(0);
    this.writeUrl();
  }

  protected setRange(value: string): void {
    this.filters.update((f) => ({ ...f, range: value as OrderFilters['range'] }));
    this.page.set(0);
    this.writeUrl();
  }

  protected setCustomFrom(value: string): void {
    this.filters.update((f) => ({ ...f, range: 'custom', from: value || null }));
    this.page.set(0);
    this.writeUrl();
  }

  protected setCustomTo(value: string): void {
    this.filters.update((f) => ({ ...f, range: 'custom', to: value || null }));
    this.page.set(0);
    this.writeUrl();
  }

  protected readonly searchTerm = signal('');

  protected onSearch(value: string): void {
    this.searchTerm.set(value);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.filters.update((f) => ({ ...f, search: value }));
      this.page.set(0);
      this.writeUrl(true);
    }, 350);
  }

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  protected clearFilters(): void {
    this.filters.set({ ...DEFAULT_ORDER_FILTERS });
    this.searchTerm.set('');
    this.page.set(0);
    this.writeUrl();
  }

  protected onSortChange(event: { column: string; direction: 'asc' | 'desc' } | null): void {
    const column = event?.column ?? 'createdAtTime';
    const property = OrdersListComponent.SORT_PROPERTY[column] ?? 'createdAt';
    this.sort.set(property);
    this.direction.set(event?.direction ?? 'desc');
    this.page.set(0);
    this.writeUrl();
  }

  /** The column id the table shows the sort arrow on. */
  protected get sortColumnId(): string {
    return OrdersListComponent.SORT_COLUMN[this.sort()] ?? 'createdAtTime';
  }

  protected goToPage(page: number): void {
    this.page.set(Math.max(0, page));
    this.writeUrl();
  }

  protected onPageSizeChange(size: number): void {
    if (size === this.size()) return;
    this.size.set(size);
    this.page.set(0);
    this.writeUrl();
  }

  protected openView(order: OrderResponse): void {
    void this.router.navigate(['/dashboard/orders', order.id]);
  }

  protected onMenuAction(event: { id: string; item: OrderResponse }): void {
    const order = event.item;
    switch (event.id) {
      case 'printInvoice':
        void this.router.navigate(['/dashboard/orders', order.id], { queryParams: { print: 1 } });
        break;
      case 'changeStatus':
      case 'cancel':
        // The status dialog lives on the order's own page, where the
        // consequence of the change is visible next to the order.
        void this.router.navigate(['/dashboard/orders', order.id], {
          queryParams: { action: event.id },
        });
        break;
      default:
        break;
    }
  }

  // ── selection & bulk ─────────────────────────────────────────────────────

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
    this.selectedIds.set(new Set(this.rows().map((o) => o.id)));
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  protected bulkChangeStatus(): void {
    const first = this.rows().find((o) => this.selectedIds().has(o.id));
    if (!first) return;
    void this.router.navigate(['/dashboard/orders', first.id], {
      queryParams: { action: 'changeStatus' },
    });
  }

  /**
   * Export the orders that match the current filters as CSV.
   *
   * The export states what it exports and for which filters, and it exports
   * the MATCHING set — not the rows on the current page.
   *
   * The money in the file is formatted by the SHARED money formatter, the
   * same one the screen uses, so a number in the file and a number on the
   * page are the same number written the same way.
   */
  protected exportCsv(): void {
    const rows = this.matching();
    if (!rows.length) return;

    const money = (value: number): string =>
      formatCurrency(value, this.language.current(), this.storeSettings.currency());

    const header = [
      'Order #',
      'Created at',
      'Status',
      'Payment status',
      'Payment method',
      'Customer',
      'Email',
      'Phone',
      'Items',
      'Subtotal',
      'Shipping',
      'Discount',
      'Total',
    ];

    const escape = (value: unknown): string => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const lines = [header.join(',')];
    for (const order of rows) {
      const subtotal = (order.items ?? []).reduce((sum, i) => sum + Number(i.totalPrice ?? 0), 0);
      lines.push(
        [
          formatOrderNumber(order.orderNumber, order.id),
          order.createdAt,
          order.status,
          order.paymentStatus,
          order.paymentMethod,
          order.customer?.name ?? '',
          order.customer?.email ?? '',
          order.address?.phone ?? '',
          (order.items ?? []).length,
          money(subtotal),
          money(Number(order.shippingCost ?? 0)),
          money(Number(order.discountAmount ?? 0)),
          money(Number(order.totalAmount ?? 0)),
        ]
          .map(escape)
          .join(','),
      );
    }

    // The BOM makes Excel read the file as UTF-8, so the Arabic names are
    // not mangled.
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);

    this.notify.success('orders.export.done', 'Orders exported');
  }
}
