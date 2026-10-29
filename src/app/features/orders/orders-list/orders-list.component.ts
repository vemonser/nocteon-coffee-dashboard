import { Component, computed, inject, signal, effect } from '@angular/core';
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
  lucideCopy,
  lucideInfo,
  lucideTrendingUp,
  lucideUsers,
  lucideDollarSign,
  lucideXCircle,
  lucideCheck,
  lucideMinus,
  lucidePlus,
  lucidePercent,
  lucideArchive,
  lucideFileText,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';

import { BrnTooltip } from '@spartan-ng/brain/tooltip';

import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { CanDisableDirective } from '../../../shared/directives/can-disable.directive';
import { PermissionService } from '../../../core/auth/permission.service';
import { KpiCardComponent } from '../../../shared/components/dashboard/kpi-card/kpi-card.component';
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
  OrderStatsResponse,
} from '../models/order.model';
import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  orderStatusKind,
  paymentStatusKind,
  effectivePaymentStatus,
  canChangeStatus,
  canCancel,
  canRefund,
} from '../models/order-status.model';
import { computeKpi, tabToApiParams, type KpiValues } from '../utils/order-kpi';
import {
  bulkStatusToast,
  eligibleRows,
  runBulkStatus,
  summarizeBulkStatus,
  type BulkStatusResult,
  type BulkStatusRow,
} from '../utils/bulk-status';
import { OrderBulkStatusDialogComponent } from '../components/order-bulk-status-dialog/order-bulk-status-dialog.component';
import { OrderBulkStatusFailuresDialogComponent } from '../components/order-bulk-status-failures-dialog/order-bulk-status-failures-dialog.component';
import { ORDER_COUNT_SCOPES } from '../../../core/dashboard/order-scope';
import type { RowMenuAction } from '../../../shared/ui/actions-cell/actions-cell.component';
import { formatCurrencyPlain } from '../../../shared/utils/locale-format';
import { formatOrderNumber } from '../utils/order-number';
import { orderItemsCount } from '../utils/order-items-count';

/**
 * The orders list — v4.
 *
 * The page state lives in the URL (tab, filters, sort, page) so links are
 * shareable and refresh/back-button work.
 *
 * Two sets, named once:
 *   - FILTERED SET = date range + payment status/method + search (NO tab)
 *   - VIEW = filtered set ∩ selected tab
 *
 * The rows, the pager, the header count, and all 4 KPI cards describe the VIEW.
 * The tab counts are the single exception: facet counts of the filtered set,
 * so clicking a tab doesn't zero the other tabs.
 *
 * The backend stats endpoint now returns `revenue` and `revenueOrderCount`
 * for the exact filter you send, so the KPI cards never read the whole set.
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
    KpiCardComponent,
    TranslocoPipe,
    MoneyPipe,
    CanDisableDirective,
    OrderBulkStatusDialogComponent,
    OrderBulkStatusFailuresDialogComponent,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideDownload,
      lucideX,
      lucideCreditCard,
      lucideBanknote,
      lucideCopy,
      lucideInfo,
      lucideTrendingUp,
      lucideUsers,
      lucideDollarSign,
      lucideCheck,
      lucideMinus,
      lucidePlus,
      lucidePercent,
      lucideArchive,
      lucideFileText,
      lucideXCircle,
    }),
  ],
  templateUrl: './orders-list.component.html',
})
export class OrdersListComponent {
  private readonly orderService = inject(OrderService);
  private readonly notify = inject(NotifyService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly language = inject(LanguageService);
  protected readonly names = inject(LocalizedNameService);
  private readonly storeSettings = inject(StoreSettingsService);
  protected readonly storeCurrency = computed(() => this.storeSettings.currency());
  private readonly transloco = inject(TranslocoService);

  /** The rows of the current page (the VIEW). */
  protected readonly rows = signal<OrderResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** The VIEW's total (for the pager). */
  protected readonly pageTotal = signal(0);

  /** The FILTERED SET totals (for the scope note). */
  protected readonly filteredTotal = signal(0);
  protected readonly allTotal = signal(0);

  /** Status counts for the FILTERED SET (for tab counts). */
  protected readonly statusCounts = signal<Record<string, number>>({});

  /** KPI values for the VIEW (from backend stats with tab). */
  protected readonly kpi = signal<KpiValues>({ revenue: 0, openCount: 0, avgOrderValue: 0, cancelRate: 0 });

  /** Current tab. */
  protected readonly status = signal<OrderStatus | 'ALL' | 'REFUNDED'>('ALL');
  protected readonly paymentStatus = signal<PaymentStatus | 'ALL'>('ALL');
  protected readonly paymentMethod = signal<PaymentMethod | 'ALL'>('ALL');
  protected readonly range = signal<'today' | '7d' | '30d' | 'all' | 'custom'>('all');
  protected readonly dateFrom = signal<string | null>(null);
  protected readonly dateTo = signal<string | null>(null);
  protected readonly searchField = signal('');
  protected readonly searchTerm = signal('');

  protected readonly sort = signal('createdAt');
  protected readonly direction = signal<'asc' | 'desc'>('desc');
  protected readonly page = signal(0);
  protected readonly size = signal(20);
  protected readonly selectedIds = signal<ReadonlySet<number>>(new Set());

  /** ── the bulk status run (FE-18) ─────────────────────────────────────── */

  /** The bulk dialog: pick one status for the selection. */
  protected readonly bulkStatusOpen = signal(false);
  /** A run is in flight — one order at a time. */
  protected readonly bulkStatusPending = signal(false);
  protected readonly bulkStatusProgress = signal<{ done: number; total: number } | null>(null);
  /** The rows the last run could not change, with the reason each gave. */
  protected readonly bulkFailures = signal<readonly BulkStatusResult[]>([]);
  protected readonly bulkFailuresOpen = signal(false);

  /** The selected rows, in the shape the bulk dialog reads. */
  protected readonly selectedRows = computed<BulkStatusRow[]>(() =>
    this.rows()
      .filter((row) => this.selectedIds().has(row.id))
      .map((row) => ({
        id: row.id,
        orderNumber: formatOrderNumber(row.orderNumber, row.id),
        status: row.status,
      })),
  );

  protected readonly pageSizeOptions = [10, 20, 50] as const;

  protected readonly statuses = ORDER_STATUSES;
  protected readonly paymentStatuses = PAYMENT_STATUSES;
  protected readonly paymentMethods = PAYMENT_METHODS;

  private requestId = 0;

  /** ── the derived view ───────────────────────────────────────────────── */

  protected readonly visibleRows = computed(() => this.rows());

  protected readonly selectedCount = computed(() => this.selectedIds().size);

  /** Scope note — filter-aware. */
  protected readonly scopeNote = computed(() => {
    const base = this.hasActiveFilters() || this.status() !== 'ALL'
      ? ORDER_COUNT_SCOPES.all.helpKey.replace('allHelp', 'matchingHelp')
      : ORDER_COUNT_SCOPES.all.helpKey;
    const key = this.status() !== 'ALL'
      ? `orders.orderScope.filteredWithTab`
      : this.hasActiveFilters()
        ? `orders.orderScope.matchingHelp`
        : `orders.orderScope.allHelp`;
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value !== key ? value : key;
  });

  /** The tab's label key for the scope note. */
  protected readonly tabLabel = computed(() => {
    const tab = this.status();
    if (tab === 'ALL') return 'orders.statusFilter.all';
    if (tab === 'REFUNDED') return 'orders.statusFilter.refunded';
    return `orders.statuses.${tab}`;
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.pageTotal() / this.size())),
  );

  protected readonly first = computed(() => this.page() === 0);
  protected readonly last = computed(() => this.page() >= this.totalPages() - 1);

  /** Empty state message: a store with no orders, or orders the filters exclude. */
  protected readonly emptyMessage = computed(() => {
    if (this.filteredTotal() === 0 && !this.hasActiveFilters() && this.status() === 'ALL') {
      return this.t('orders.emptyState.noOrders', 'No orders yet');
    }
    if (this.filteredTotal() === 0) {
      return this.t('orders.emptyState.noResults', 'No orders match these filters');
    }
    return this.t('orders.empty', 'No orders found');
  });

  /** Translate with English fallback — never a raw key. */
  protected t(key: string, fallback: string): string {
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }

  /** Status counts for the FILTERED SET (for tab counts). */
  protected readonly counts = computed(() => this.statusCounts());

  /** Whether any filter (other than the tab) is active. */
  protected readonly hasActiveFilters = computed(
    () =>
      this.paymentStatus() !== 'ALL' ||
      this.paymentMethod() !== 'ALL' ||
      this.range() !== 'all' ||
      this.searchTerm().trim() !== '',
  );

  /** The 7 tabs: All + 5 order statuses + Refunded (payment status). */
  protected readonly tabs = computed((): Array<{ id: OrderStatus | 'ALL' | 'REFUNDED'; label: string; count: number }> => [
    { id: 'ALL', label: 'orders.statusFilter.all', count: this.allTotal() },
    { id: 'PENDING', label: 'orders.statuses.PENDING', count: this.counts()['PENDING'] ?? 0 },
    { id: 'PROCESSING', label: 'orders.statuses.PROCESSING', count: this.counts()['PROCESSING'] ?? 0 },
    { id: 'SHIPPED', label: 'orders.statuses.SHIPPED', count: this.counts()['SHIPPED'] ?? 0 },
    { id: 'DELIVERED', label: 'orders.statuses.DELIVERED', count: this.counts()['DELIVERED'] ?? 0 },
    { id: 'CANCELLED', label: 'orders.statuses.CANCELLED', count: this.counts()['CANCELLED'] ?? 0 },
    { id: 'REFUNDED', label: 'orders.statusFilter.refunded', count: this.counts()['REFUNDED'] ?? 0 },
  ]);

  /** ── the columns ────────────────────────────────────────────────────── */

  private readonly columnHelper = createColumnHelper<OrderResponse>();

  /** Column order: select, order #, customer, items, order status, payment status, method, total, created at, actions. */
  protected readonly columns: ColumnDef<OrderResponse, any>[] = [
    this.columnHelper.accessor(
      (row) => formatOrderNumber(row.orderNumber, row.id),
      { id: 'orderNumber', header: 'orders.columns.orderNumber', enableSorting: false, meta: { width: '170px' } },
    ),
    this.columnHelper.accessor(
      (row) => ({ name: row.customer?.name ?? null, email: row.customer?.email ?? null }),
      { id: 'customer', header: 'orders.columns.customer', enableSorting: false, meta: { width: '24%' } },
    ),
    this.columnHelper.accessor(
      (row) => orderItemsCount(row),
      { id: 'itemCount', header: 'orders.columns.items', enableSorting: false, meta: { width: '90px' } },
    ),
    this.columnHelper.accessor(
      (row) => orderStatusKind(row.status),
      { id: 'orderStatus', header: 'orders.columns.status', enableSorting: true, meta: { width: '112px' } },
    ),
    this.columnHelper.accessor(
      (row) => paymentStatusKind(effectivePaymentStatus(row)),
      { id: 'paymentStatus', header: 'orders.columns.paymentStatus', enableSorting: true, meta: { width: '130px' } },
    ),
    this.columnHelper.accessor(
      (row) => ({
        icon: row.paymentMethod === 'ONLINE' ? 'lucideCreditCard' : 'lucideBanknote',
        method: row.paymentMethod,
      }),
      { id: 'paymentMethod', header: 'orders.columns.paymentMethod', enableSorting: false, meta: { width: '151px' } },
    ),
    this.columnHelper.accessor('totalAmount', {
      id: 'totalAmount',
      header: 'orders.columns.total',
      enableSorting: true,
      meta: { width: '105px', align: 'end' },
    }),
    this.columnHelper.accessor('createdAt', {
      id: 'createdAtTime',
      header: 'orders.columns.createdAt',
      enableSorting: true,
      meta: { width: '102px' },
    }),
    this.columnHelper.display({ id: 'actions', header: 'orders.columns.actions', meta: { width: '78px' } }),
  ];

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

  protected readonly rowId = (row: OrderResponse): number | null => row?.id ?? null;

  protected readonly cellHref = (columnId: string, row: OrderResponse): any[] | null =>
    columnId === 'orderNumber' ? ['/dashboard/orders', row.id] : null;

  /** Row menu actions. */
  protected readonly menuActions: RowMenuAction[] = [
    { id: 'changeStatus', label: 'orders.actions.changeStatus', icon: 'lucideRefreshCw' },
    { id: 'printInvoice', label: 'orders.actions.printInvoice', icon: 'lucidePrinter' },
    { id: 'cancel', label: 'orders.actions.cancel', icon: 'lucideCircleSlash', danger: true },
  ];

  constructor() {
    this.readUrl();
    // The URL the page opened with IS the state the first load answers, so
    // the subscription below does not ask for the same rows twice.
    this.loadedState = JSON.stringify(this.currentState());
    this.load();

    this.route.queryParamMap.subscribe((params) => {
      const next = this.stateFromParams(params);
      // The comparison is with the state of the LAST LOAD, not with the
      // signals: a control that sets its own signal first (the status tab,
      // the page size) would otherwise look unchanged to the URL, and the
      // table would keep showing the old rows.
      if (JSON.stringify(next) !== JSON.stringify(this.loadedState)) {
        this.applyState(next);
        this.load();
      }
    });
  }

  // ── URL state ────────────────────────────────────────────────────────────

  /**
   * The state the rows on screen were loaded with.
   *
   * <p>The URL is the request: a control writes the URL, and the URL
   * subscription asks the API again. This snapshot is what the subscription
   * compares against, so a control that sets its own signal first still
   * triggers a reload.
   */
  private loadedState: string = '';

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
      status: (['ALL', 'REFUNDED', ...ORDER_STATUSES] as const).includes(status as never)
        ? (status as OrderStatus | 'ALL' | 'REFUNDED')
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

  // ── the API filters ──────────────────────────────────────────────────────

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

  /** Filters WITHOUT the status tab — for the facet counts. */
  private apiFilter(): OrderFilterRequest {
    const range = this.apiRange();
    return {
      paymentStatus: this.paymentStatus() === 'ALL' ? undefined : (this.paymentStatus() as PaymentStatus),
      paymentMethod: this.paymentMethod() === 'ALL' ? undefined : (this.paymentMethod() as PaymentMethod),
      search: this.searchTerm().trim() || undefined,
      ...range,
    };
  }

  /** Filters WITH the status tab — for the view (rows + KPIs). */
  private apiFilterWithTab(): OrderFilterRequest {
    const filter = this.apiFilter();
    const tab = this.status();
    const tabParams = tabToApiParams(tab);
    return { ...filter, ...tabParams };
  }

  // ── loading ──────────────────────────────────────────────────────────────

  /**
   * Load the view (rows + KPIs) and the facet counts.
   *
   * Two stats calls:
   *  1. Facets (filtered set, no tab) → tab counts
   *  2. Cards (filtered set + tab) → KPIs for the view
   * Rows come from the list endpoint with the tab.
   */
  protected load(): void {
    const requestId = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);

    const filter = this.apiFilter();
    const filterWithTab = this.apiFilterWithTab();
    const tab = this.status();

    forkJoin({
      rows: this.orderService.getAll({
        page: this.page(),
        size: this.size(),
        sort: this.sort(),
        direction: this.direction(),
        ...filterWithTab,
      }),
      facets: this.orderService.getStats(filter),
      cards: this.orderService.getStats(filterWithTab),
    }).subscribe({
      next: ({ rows, facets, cards }) => {
        if (requestId !== this.requestId) return;

        this.rows.set(rows.data?.content ?? []);
        this.pageTotal.set(rows.data?.totalElements ?? 0);

        // The selection only ever describes rows that are ON SCREEN: a status
        // run can move a row off the current tab, and a page change replaces
        // the rows entirely. Keeping an invisible id selected would let the
        // bulk bar count rows the admin cannot see.
        const visible = new Set(this.rows().map((order) => order.id));
        const kept = [...this.selectedIds()].filter((id) => visible.has(id));
        if (kept.length !== this.selectedIds().size) this.selectedIds.set(new Set(kept));

        // The FILTERED set's total — the same set the tab counts describe.
        // It is the facets call's total, so the page needs no fourth
        // request for the "All orders" tab.
        this.filteredTotal.set(facets.data?.total ?? 0);
        this.allTotal.set(facets.data?.total ?? 0);

        const counts: Record<string, number> = {};
        for (const entry of facets.data?.byStatus ?? []) {
          counts[entry.status] = entry.count;
        }
        // "Refunded" is a PAYMENT status, not an order status: count it from
        // the payment-status facets so the tab reflects orders whose payment
        // was refunded (even when their fulfilment status is something else).
        const refundedCount = (facets.data?.byPaymentStatus ?? []).find(
          (entry: { paymentStatus: string; count: number }) => entry.paymentStatus === 'REFUNDED',
        )?.count ?? 0;
        counts['REFUNDED'] = refundedCount;
        this.statusCounts.set(counts);

        // KPIs from the card stats (with tab)
        this.kpi.set(computeKpi(cards.data as OrderStatsResponse, counts, this.filteredTotal()));

        // The rows on screen now answer THIS state, so the URL subscription
        // knows what it is comparing against.
        this.loadedState = JSON.stringify(this.currentState());
        this.loading.set(false);
      },
      error: (err) => {
        if (requestId !== this.requestId) return;
        this.loading.set(false);
        this.error.set(err?.error?.message ?? this.t('orders.errorState.title', 'The orders could not be loaded'));
      },
    });
  }

  protected retry(): void {
    this.load();
  }

  // ── interactions ─────────────────────────────────────────────────────────

  protected setStatus(status: OrderStatus | 'ALL' | 'REFUNDED'): void {
    if (this.status() === status) return;
    this.status.set(status);
    this.page.set(0);
    this.selectedIds.set(new Set());
    this.writeUrl();
  }

  protected setPaymentStatus(value: string): void {
    if (this.status() === 'REFUNDED' && value !== 'ALL') return; // disabled when Refunded tab active
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

  // ── bulk status (FE-18) ──────────────────────────────────────────────────

  /**
   * "Change status" in the bulk bar: open the dialog that picks ONE status
   * for the selection.
   *
   * <p>Before FE-18 this opened the first selected order's detail dialog,
   * which is not a bulk action — the other rows were silently untouched.
   * The permission is checked here as well as on the button, so a disabled
   * control is not the only thing standing between a reader and the action.
   */
  protected bulkChangeStatus(): void {
    if (!this.permissions.has('order:update')) return;
    if (this.selectedIds().size === 0) return;
    this.bulkFailures.set([]);
    this.bulkStatusOpen.set(true);
  }

  protected closeBulkStatus(): void {
    if (this.bulkStatusPending()) return;
    this.bulkStatusOpen.set(false);
  }

  /**
   * Apply the chosen status to the rows that can take it — SEQUENTIALLY.
   *
   * <p>`runBulkStatus` sends one request at a time (`concatMap`), records a
   * per-row outcome, and stops only on a `403`: a permission error is not
   * per-row, so the remaining rows are reported as "not attempted" instead of
   * firing eleven more refusals (which would also mean eleven permission
   * toasts on top of the interceptor's one).
   */
  protected applyBulkStatus(status: OrderStatus): void {
    const targets = eligibleRows(this.selectedRows(), status);
    if (targets.length === 0) return;

    this.bulkStatusPending.set(true);
    this.bulkStatusProgress.set({ done: 0, total: targets.length });
    this.bulkFailures.set([]);

    runBulkStatus(targets, {
      update: (row) => this.orderService.updateStatus(row.id, { status }),
      fallbackReason: this.t('orders.bulk.failures.reason', 'The order could not be updated'),
      abortedReason: this.t(
        'orders.bulk.failures.aborted',
        'Not attempted — the run stopped after a permission error.',
      ),
      onProgress: (done, total) => this.bulkStatusProgress.set({ done, total }),
      backendMessage: (err) => this.notify.backendMessage(err),
    }).subscribe((results) => this.finishBulkStatus(results));
  }

  /** Add the outcomes up, tell the reader once, and settle the selection. */
  private finishBulkStatus(results: readonly BulkStatusResult[]): void {
    const summary = summarizeBulkStatus(results);
    this.bulkStatusPending.set(false);
    this.bulkStatusProgress.set(null);
    this.bulkStatusOpen.set(false);
    this.bulkFailures.set(summary.failures);

    // The rows that failed stay selected, so the admin can fix the cause and
    // run the change again without re-picking them; a clean run clears.
    this.selectedIds.set(new Set(summary.failedIds));

    // Re-read the page: the rows on screen now show the statuses the server
    // actually holds, and any row that left the current tab drops out.
    this.load();

    const plan = bulkStatusToast(summary);
    if (plan.tone === 'success') {
      this.notify.successCount(plan.messageBase, plan.count);
      return;
    }

    const review = this.t('orders.bulk.reviewFailures', 'Review failures');
    this.notify.warningCountWithAction(
      plan.messageBase,
      plan.count,
      { label: review, onClick: () => this.bulkFailuresOpen.set(true) },
      {
        description: plan.failureBase
          ? this.notify.countText(plan.failureBase, plan.failureCount)
          : undefined,
        durationMs: 12000,
      },
    );

    // The per-row list is the only actionable part of a partial run, so it
    // opens rather than waiting for the reader to find the toast action.
    if (plan.openFailures) this.bulkFailuresOpen.set(true);
  }

  protected closeBulkFailures(): void {
    this.bulkFailuresOpen.set(false);
  }

  /**
   * "Retry failed": reopen the picker with the failed rows still selected, so
   * the retry goes through the SAME transition check. Re-sending the refused
   * status blindly would just collect the same refusals.
   */
  protected retryBulkFailures(): void {
    this.bulkFailuresOpen.set(false);
    this.bulkStatusOpen.set(true);
  }

  /** Export the VIEW (filtered set ∩ tab) as CSV — walks all pages. */
  protected exportCsv(): void {
    const filterWithTab = this.apiFilterWithTab();
    this.loading.set(true);

    this.orderService
      .getEveryOrder(filterWithTab)
      .subscribe({
        next: (allRows) => {
          this.loading.set(false);
          this.exportRows(allRows);
        },
        error: () => {
          this.loading.set(false);
          this.notify.apiError(new Error(), 'orders.export.error', 'Export failed');
        },
      });
  }

  private exportRows(rows: OrderResponse[]): void {
    const money = (value: number): string =>
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
          effectivePaymentStatus(order),
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