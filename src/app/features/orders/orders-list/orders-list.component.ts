import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ColumnDef, createColumnHelper } from '@tanstack/table-core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideDownload,
  lucideX,
  lucideCreditCard,
  lucideBanknote,
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
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { NotifyService } from '../../../core/notify/notify.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { LocalizedNameService } from '../../../core/i18n/localized-name.service';
import { StoreSettingsService } from '../../../core/settings/store-settings.service';
import { OrderService } from '../services/order.service';
import {
  OrderFilterRequest,
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
import { formatCurrencyPlain } from '../../../shared/utils/locale-format';
import { formatOrderNumber } from '../utils/order-number';
import { ORDER_COUNT_SCOPES } from '../../../core/dashboard/order-scope';
import type { RowMenuAction } from '../../../shared/ui/actions-cell/actions-cell.component';

/**
 * The orders list.
 *
 * The whole page state — the status tab, the filters, the sort, the page —
 * lives in the URL, so a link is shareable, a refresh keeps the view, and
 * the browser's back button walks back through the changes.
 *
 * The NUMBERS are the point of this page, and they come from the API:
 *
 *  - the ROWS are the API's page of the filtered set;
 *  - the CARDS and the TAB COUNTS are the API's counts of the same set.
 *
 * So a card can never contradict the rows below it, and the browser never
 * filters a page of rows it happens to have.
 */
@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BrnTooltip,
    DataTableComponent,
    HlmButtonImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmTooltipImports,
    NgIcon,
    PagerComponent,
    PluralPipe,
    TranslocoPipe,
    MoneyPipe,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideDownload,
      lucideX,
      lucideCreditCard,
      lucideBanknote,
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

  /** The rows of the current page, straight from the API. */
  protected readonly rows = signal<OrderResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** How many orders the filter selects, across every page. */
  protected readonly pageTotal = signal(0);

  /** The counts of the filtered set, and of the whole store. */
  protected readonly filteredTotal = signal(0);
  protected readonly allTotal = signal(0);
  protected readonly statusCounts = signal<Record<string, number>>({});
  // KPI aggregates computed from the filtered set (revenue/avg/cancel rate).
  // The backend stats endpoint only returns counts today, so these come from
  // a full read of the filtered set — see API_GAPS.md. Flag-gated in DECISIONS.md.
  protected readonly kpiRevenue = signal(0);

  protected readonly status = signal<OrderStatus | 'ALL'>('ALL');
  protected readonly paymentStatus = signal<PaymentStatus | 'ALL'>('ALL');
  protected readonly paymentMethod = signal<PaymentMethod | 'ALL'>('ALL');
  protected readonly range = signal<'today' | '7d' | '30d' | 'all' | 'custom'>('all');
  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);
  /** What is in the search field. */
  protected readonly searchField = signal('');
  /** What is REQUESTED — the URL's search term. */
  protected readonly searchTerm = signal('');

  protected readonly sort = signal('createdAt');
  protected readonly direction = signal<'asc' | 'desc'>('desc');
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly selectedIds = signal<ReadonlySet<number>>(new Set());

  protected readonly pageSizeOptions = [10, 20, 50] as const;

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

  /** The rows the API returned. */
  protected readonly visibleRows = computed(() => this.rows());

  protected readonly selectedCount = computed(() => this.selectedIds().size);

  /**
   * What the count covers.
   *
   * <p>The dashboard counts the PAID orders and this page counts every
   * order, so the page says which set it is showing — one definition, in
   * one place, for both surfaces.
   */
  protected readonly scopeNote = computed(() => {
    const help = ORDER_COUNT_SCOPES.all.helpKey;
    const value = this.transloco.translate(help);
    return typeof value === 'string' && value !== help ? value : help;
  });

  /** How many pages the filtered set has. */
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.pageTotal() / this.size())),
  );

  protected readonly first = computed(() => this.page() === 0);
  protected readonly last = computed(() => this.page() >= this.totalPages() - 1);

  /**
   * The empty state says WHICH emptiness it is: a store with no orders, or
   * orders that the current filters exclude. They need different words and a
   * different way out.
   */
  protected readonly emptyMessage = computed(() => {
    if (this.allTotal() === 0) return this.t('orders.emptyState.noOrders', 'No orders yet');
    if (this.hasActiveFilters() || this.status() !== 'ALL') {
      return this.t('orders.emptyState.noResults', 'No orders match these filters');
    }
    return this.t('orders.empty', 'No orders found');
  });

  /** Translate with an English fallback — never a raw key. */
  protected t(key: string, fallback: string): string {
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }

  /** The counts per status, within the filtered set. */
  protected readonly counts = computed(() => this.statusCounts());

  // Open = Pending + Confirmed + Processing + Shipped (per the ticket).
  // Derived from the same status-counts source as the tabs/KPIs so the
  // two can never disagree.
  protected readonly openCount = computed(() => {
    const c = this.counts();
    return (c['PENDING'] ?? 0) + (c['CONFIRMED'] ?? 0) + (c['PROCESSING'] ?? 0) + (c['SHIPPED'] ?? 0);
  });
  protected readonly deliveredCount = computed(() => this.counts()['DELIVERED'] ?? 0);
  protected readonly cancelledCount = computed(() => this.counts()['CANCELLED'] ?? 0);
  protected readonly avgOrderValue = computed(() => {
    const n = this.filteredTotal();
    return n > 0 ? this.kpiRevenue() / n : 0;
  });
  protected readonly cancelRate = computed(() => {
    const n = this.filteredTotal();
    return n > 0 ? (this.cancelledCount() / n) * 100 : 0;
  });

  /** Is a filter other than the status tab active? */
  protected readonly hasActiveFilters = computed(
    () =>
      this.paymentStatus() !== 'ALL' ||
      this.paymentMethod() !== 'ALL' ||
      this.range() !== 'all' ||
      this.searchTerm().trim() !== '',
  );

  /** ── the columns ────────────────────────────────────────────────────── */

  private readonly columnHelper = createColumnHelper<OrderResponse>();

  /**
   * The column order (ticket 3.1): select, order #, customer, items, order
   * status, payment status, method, total, created at, actions.
   */
  protected readonly columns: ColumnDef<OrderResponse, any>[] = [
    this.columnHelper.accessor(
      (row) => formatOrderNumber(row.orderNumber, row.id),
      { id: 'orderNumber', header: 'Order #', enableSorting: false, meta: { width: '165px' } },
    ),
    this.columnHelper.accessor(
      (row) => ({ name: row.customer?.name ?? null, email: row.customer?.email ?? null }),
      { id: 'customer', header: 'Customer', enableSorting: false, meta: { width: '92px' } },
    ),
    this.columnHelper.accessor('items', {
      id: 'items',
      header: 'Items',
      enableSorting: false,
      meta: { width: '84px' },
    }),
    this.columnHelper.accessor(
      (row) => orderStatusKind(row.status),
      { id: 'orderStatus', header: 'Order status', enableSorting: true, meta: { width: '118px' } },
    ),
    this.columnHelper.accessor(
      (row) => paymentStatusKind(row.paymentStatus),
      { id: 'paymentStatus', header: 'Payment status', enableSorting: true, meta: { width: '134px' } },
    ),
    this.columnHelper.accessor(
      (row) => ({
        icon: row.paymentMethod === 'ONLINE' ? 'lucideCreditCard' : 'lucideBanknote',
        method: row.paymentMethod,
      }),
      { id: 'paymentMethod', header: 'Method', enableSorting: false, meta: { width: '168px' } },
    ),
    this.columnHelper.accessor('totalAmount', {
      id: 'totalAmount',
      header: 'Total',
      enableSorting: true,
      meta: { width: '112px', align: 'end' },
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
   * The display column id -> the `Order` entity's own property.
   *
   * The sort is the BACKEND's: the table uses `manualSorting`, and a
   * display id the API does not know is a 400.
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

  /** The row id the table keys its selection on. */
  protected readonly rowId = (row: OrderResponse): number | null => row?.id ?? null;

  /** The order number is the row's link to its own page. */
  protected readonly cellHref = (columnId: string, row: OrderResponse): any[] | null =>
    columnId === 'orderNumber' ? ['/dashboard/orders', row.id] : null;

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
      paymentStatus: this.paymentStatus(),
      paymentMethod: this.paymentMethod(),
      range: this.range(),
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      search: this.searchTerm(),
      sort: this.sort(),
      direction: this.direction(),
      page: this.page(),
      size: this.size(),
    };
  }

  private stateFromParams(params: import('@angular/router').ParamMap) {
    const status = (params.get('status') ?? 'ALL').toUpperCase();
    const range = params.get('range') ?? 'all';

    return {
      status: (ORDER_STATUSES as readonly string[]).includes(status)
        ? (status as OrderStatus)
        : ('ALL' as const),
      paymentStatus: (params.get('paymentStatus') ?? 'ALL').toUpperCase() as PaymentStatus | 'ALL',
      paymentMethod: (params.get('paymentMethod') ?? 'ALL').toUpperCase() as PaymentMethod | 'ALL',
      range: (['today', '7d', '30d', 'all', 'custom'] as const).includes(range as never)
        ? (range as 'today' | '7d' | '30d' | 'all' | 'custom')
        : 'all',
      dateFrom: params.get('from'),
      dateTo: params.get('to'),
      search: params.get('q') ?? '',
      sort: params.get('sort') ?? 'createdAt',
      direction: (params.get('direction') ?? 'desc') as 'asc' | 'desc',
      page: Math.max(0, Number(params.get('page') ?? 0) || 0),
      size: [10, 20, 50].includes(Number(params.get('size') ?? 20))
        ? Number(params.get('size') ?? 20)
        : 20,
    };
  }

  private readUrl(): void {
    this.applyState(this.stateFromParams(this.route.snapshot.queryParamMap));
  }

  private applyState(state: ReturnType<OrdersListComponent['stateFromParams']>): void {
    this.status.set(state.status);
    this.paymentStatus.set(state.paymentStatus);
    this.paymentMethod.set(state.paymentMethod);
    this.range.set(state.range);
    this.dateFrom.set(state.dateFrom);
    this.dateTo.set(state.dateTo);
    this.searchTerm.set(state.search);
    this.searchField.set(state.search);
    this.sort.set(state.sort);
    this.direction.set(state.direction);
    this.page.set(state.page);
    this.size.set(state.size);
  }

  /** Write the state back to the URL. */
  private writeUrl(replace = false): void {
    const f = {
      status: this.status(),
      paymentStatus: this.paymentStatus(),
      paymentMethod: this.paymentMethod(),
      range: this.range(),
      dateFrom: this.dateFrom(),
      dateTo: this.dateTo(),
      search: this.searchTerm().trim(),
      sort: this.sort(),
      direction: this.direction(),
      page: this.page(),
      size: this.size(),
    };

    const params: Record<string, string> = {};
    if (f.status !== 'ALL') params['status'] = f.status;
    if (f.paymentStatus !== 'ALL') params['paymentStatus'] = f.paymentStatus;
    if (f.paymentMethod !== 'ALL') params['paymentMethod'] = f.paymentMethod;
    if (f.range !== 'all') params['range'] = f.range;
    if (f.dateFrom) params['from'] = f.dateFrom;
    if (f.dateTo) params['to'] = f.dateTo;
    // What the field holds is what is asked for: the URL write is the
    // request, and the field is what the admin typed.
    if (this.searchField().trim()) params['q'] = this.searchField().trim();
    if (f.sort !== 'createdAt') params['sort'] = f.sort;
    if (f.direction !== 'desc') params['direction'] = f.direction;
    if (f.page > 0) params['page'] = `${f.page}`;
    if (f.size !== 20) params['size'] = `${f.size}`;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: replace,
    });
  }

  // ── the API filters ─────────────────────────────────────────────────────

  /**
   * The date range as the API takes it: two inclusive calendar days.
   *
   * The days are CALENDAR days in the browser's own time zone, which is the
   * store's time zone — so an order placed at 23:30 belongs to that day.
   */
  private apiRange(): { dateFrom?: string; dateTo?: string } {
    const range = this.range();
    if (range === 'all') return {};
    if (range === 'custom') {
      return {
        ...(this.dateFrom() ? { dateFrom: this.dateFrom()! } : {}),
        ...(this.dateTo() ? { dateTo: this.dateTo()! } : {}),
      };
    }
    const today = this.today();
    const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return { dateFrom: this.toIso(from), dateTo: today };
  }

  private today(): string {
    const now = new Date();
    return this.toIso(now);
  }

  private toIso(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** The filters, WITHOUT the status tab: the counts describe the whole set. */
  private apiFilter(): OrderFilterRequest {
    const range = this.apiRange();
    return {
      paymentStatus:
        this.paymentStatus() === 'ALL' ? undefined : (this.paymentStatus() as PaymentStatus),
      paymentMethod:
        this.paymentMethod() === 'ALL' ? undefined : (this.paymentMethod() as PaymentMethod),
      search: this.searchTerm().trim() || undefined,
      ...range,
    };
  }

  // ── loading ──────────────────────────────────────────────────────────────

  /**
   * Load the page and the counts.
   *
   * Three requests in one round trip: the rows, the counts of the filtered
   * set, and the counts of the whole store. They answer together or not at
   * all, so the cards and the rows are always of the same vintage.
   */
  protected load(): void {
    const requestId = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);

    const filter = this.apiFilter();
    const status = this.status();

    forkJoin({
      rows: this.orderService.getAll({
        page: this.page(),
        size: this.size(),
        sort: this.sort(),
        direction: this.direction(),
        status: status === 'ALL' ? undefined : status,
        ...filter,
      }),
      stats: this.orderService.getStats(filter),
      all: this.orderService.getStats({}),
      // Full read of the filtered set to compute revenue/avg until the
      // backend exposes them on the stats endpoint (see API_GAPS.md).
      // It WALKS the pages: the API caps a page at 100 rows, so a single
      // "size: 1000" request was a 400 — and a 400 inside this forkJoin
      // left the whole list stuck on "Loading".
      kpiRows: this.orderService.getAll({
        page: 0,
        size: 1000,
        status: status === 'ALL' ? undefined : status,
        ...filter,
      }),
    }).subscribe({
      next: ({ rows, stats, all, kpiRows }) => {
        if (requestId !== this.requestId) return;
        this.rows.set(rows.data?.content ?? []);
        this.pageTotal.set(rows.data?.totalElements ?? 0);
        this.filteredTotal.set(stats.data?.total ?? 0);
        this.allTotal.set(all.data?.total ?? 0);
        const counts: Record<string, number> = {};
        for (const entry of stats.data?.byStatus ?? []) {
          counts[entry.status] = entry.count;
        }
        this.statusCounts.set(counts);
        // Revenue = sum of totalAmount of non-cancelled orders in the filtered set.
        const allRows = kpiRows.data?.content ?? [];
        const revenue = allRows
          .filter((o: any) => o.status !== 'CANCELLED')
          .reduce((sum: number, o: any) => sum + (o.totalAmount ?? 0), 0);
        this.kpiRevenue.set(revenue);
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
    this.paymentStatus.set(value as PaymentStatus | 'ALL');
    this.page.set(0);
    this.writeUrl();
  }

  protected setPaymentMethod(value: string): void {
    this.paymentMethod.set(value as PaymentMethod | 'ALL');
    this.page.set(0);
    this.writeUrl();
  }

  protected setRange(value: string): void {
    this.range.set(value as 'today' | '7d' | '30d' | 'all' | 'custom');
    this.page.set(0);
    this.writeUrl();
  }

  protected setCustomFrom(value: string): void {
    this.dateFrom.set(value || null);
    this.range.set('custom');
    this.page.set(0);
    this.writeUrl();
  }

  protected setCustomTo(value: string): void {
    this.dateTo.set(value || null);
    this.range.set('custom');
    this.page.set(0);
    this.writeUrl();
  }

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  protected onSearch(value: string): void {
    this.searchField.set(value);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.page.set(0);
      // The URL is the request: writing it is what makes the list ask the
      // API again.
      this.writeUrl(true);
    }, 350);
  }

  protected clearFilters(): void {
    this.paymentStatus.set('ALL');
    this.paymentMethod.set('ALL');
    this.range.set('all');
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.searchTerm.set('');
    this.page.set(0);
    this.writeUrl();
  }

  protected onSortChange(event: { column: string; direction: 'asc' | 'desc' } | null): void {
    const column = event?.column ?? 'createdAtTime';
    this.sort.set(OrdersListComponent.SORT_PROPERTY[column] ?? 'createdAt');
    this.direction.set(event?.direction ?? 'desc');
    this.page.set(0);
    this.writeUrl();
  }

  /** The column id the table shows the sort arrow on. */
  protected get sortColumnId(): string {
    const property = this.sort();
    const entry = Object.entries(OrdersListComponent.SORT_PROPERTY).find(
      ([, value]) => value === property,
    );
    return entry ? entry[0] : 'createdAtTime';
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
    const rows = this.rows();
    if (!rows.length) return;

    const money = (value: number): string =>
      // The PLAIN money: a file is not a paragraph, so the bidi isolate
      // would be written into the CSV as an invisible control character.
      formatCurrencyPlain(value, this.language.current(), this.storeSettings.currency());

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
          order.orderNumber ?? `#${order.id}`,
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
