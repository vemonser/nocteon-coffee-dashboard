import { Injectable, inject, signal, computed, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardOverviewDto } from '../model/DashboardOverviewDto';
import { StoreSettingsService } from '../../../core/settings/store-settings.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { fetchPlan, previousValue, type FetchPlan } from '../../../core/dashboard/period-fetch';
import { currentPeriod, previousPeriod } from '../../../core/dashboard/period';
import { computeDelta } from '../../../core/dashboard/delta';

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message: string;
}

interface RevenueByDayDto {
  date: string;
  revenue: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardStatsService {
  private http = inject(HttpClient);
  private storeSettings = inject(StoreSettingsService);
  private language = inject(LanguageService);
  private baseUrl = `${environment.apiUrl}/api/dashboard/stats`;

  private _days = signal<number>(30);
  readonly days = this._days.asReadonly();

  private _overview = signal<DashboardOverviewDto | null>(null);
  private _revenuePreviousPeriod = signal<RevenueByDayDto[] | null>(null);
  readonly loading = signal(false);

  /**
   * The error of the overview request.
   *
   * A widget that cannot load must SAY so: a blank card is a bug, not an
   * empty state. The error is per SOURCE, so failing the overview shows the
   * error on the widgets that read it, and the others keep working.
   */
  private readonly _overviewError = signal<string | null>(null);
  readonly overviewError = this._overviewError.asReadonly();

  /** True when the overview has loaded at least once. */
  readonly loaded = signal(false);

  /**
   * The id of the newest request.
   *
   * Switching the range quickly (7 -> 90 -> 7) fires three requests, and
   * they can answer out of order. A response whose id is not the newest is
   * DISCARDED, so the page can never show the data of an older range.
   */
  private requestId = 0;

  /** The date ranges the last fetch was credited with (for evidence). */
  lastPlan: FetchPlan | null = null;

  /**
   * The roast levels in CANONICAL order (light -> dark).
   *
   * The overview endpoint returns the roast breakdown ordered by REVENUE, and
   * only the localized name — so a sequential ramp applied to that order
   * would give a dark roast the lightest colour. The roast-level list carries
   * the stable slugs, so the order is taken from there and the ramp follows
   * the roast, not the money.
   */
  private readonly _roastOrder = signal<string[]>([]);
  readonly roastOrder = this._roastOrder.asReadonly();

  /** The canonical slug order, lightest first. */
  private static readonly ROAST_SLUG_ORDER = [
    'light',
    'medium-light',
    'medium',
    'medium-dark',
    'dark',
  ];

  /** Public read-only access to the full overview DTO. */
  readonly overview = computed(() => this._overview());

  readonly statsCards = computed(() => {
    const data = this._overview();
    if (!data) return null;
    return {
      totalRevenue: data.totalRevenue,
      totalOrders: data.totalOrders,
      newCustomers: data.userGrowth.currentPeriodCount,
      coffeeSold: data.coffeeSoldKg,
      averageOrderValue: data.averageOrderValue,
      userGrowth: data.userGrowth,
    };
  });

  readonly revenueChartData = computed(() => this._overview()?.revenueByDay ?? []);
  readonly revenueChartPreviousPeriod = computed(() => this._revenuePreviousPeriod() ?? []);
  readonly categoryChartData = computed(() => this._overview()?.revenueByCategory ?? []);
  readonly statusChartData = computed(() => this._overview()?.ordersByStatus ?? []);
  readonly topProducts = computed(() => this._overview()?.topSellingProducts ?? []);
  readonly userGrowth = computed(() => this._overview()?.userGrowth ?? null);
  readonly onlineUsers = computed(() => this._overview()?.onlineUsersCount ?? 0);
  readonly deviceBreakdown = computed(() => this._overview()?.deviceBreakdown ?? []);
  readonly revenueByOrigin = computed(() => this._overview()?.revenueByOrigin ?? []);
  readonly revenueByRoastLevel = computed(() => this._overview()?.revenueByRoastLevel ?? []);
  readonly refundRate = computed(() => this._overview()?.refundRate ?? null);
  readonly lowStockProducts = computed(() => this._overview()?.lowStockProducts ?? []);
  readonly ordersByPaymentMethod = computed(() => this._overview()?.ordersByPaymentMethod ?? []);
  readonly repeatPurchaseRate = computed(() => this._overview()?.repeatPurchaseRate ?? null);
  readonly paidOrders = computed(() => {
    const data = this._overview();
    if (!data) return { paid: 0, refunded: 0 };
    return {
      paid: data.totalOrders,
      refunded: data.refundRate?.totalRefunded ?? 0
    };
  });

  /** Attention counts for the Needs Attention panel. */
  readonly pendingReviewsCount = computed(() => this._overview()?.pendingReviewsCount ?? 0);
  readonly unreadContactMessagesCount = computed(() => this._overview()?.unreadContactMessagesCount ?? 0);
  readonly lowStockCount = computed(() => this._overview()?.lowStockProducts?.length ?? 0);

  /** Pending orders count from ordersByStatus. */
  readonly pendingOrdersCount = computed(() => {
    const data = this._overview();
    if (!data) return 0;
    return data.ordersByStatus?.find((s) => s.status === 'PENDING')?.count ?? 0;
  });

  /**
   * Store currency. It comes from `GET /api/settings` (field `currency`,
   * ISO-4217) and is read by StoreSettingsService, which every money
   * formatter in the app shares. There is exactly ONE source of truth.
   */
  readonly storeCurrency = computed(() => this.storeSettings.currency());

  /**
   * True when the store-currency read failed. Money cards keep rendering with
   * the USD fallback, but they must not print "$" as if it had been read — so
   * the dashboard shows an explicit, retryable notice.
   */
  readonly storeCurrencyError = computed(() => this.storeSettings.error());

  constructor() {
    this.fetchOverview();
    this.loadRoastOrder();

    /**
     * The entity names in the breakdown widgets (category, origin, roast
     * level) are localized BY THE BACKEND: the `Accept-Language` header is
     * read when the query runs and the row is translated server-side. A
     * runtime UI-language switch therefore has to REFETCH — otherwise the
     * Arabic dashboard keeps the English names it was loaded with ("Coffee"
     * next to an Arabic "الإجمالي").
     *
     * `untracked` keeps the effect from depending on the data it writes.
     */
    effect(() => {
      this.language.language();
      untracked(() => this.fetchOverview());
    });
  }

  /**
   * Load the roast levels once, in canonical order, and remember their
   * localized names so the ramp can be applied to the right slice.
   */
  private loadRoastOrder(): void {
    this.http
      .get<ApiResponse<{ content?: Array<{ slug: string; name?: string; translations?: Array<{ language: string; name: string }> }> }>>(
        `${environment.apiUrl}/api/dashboard/roast-levels?page=0&size=50`,
      )
      .subscribe({
        next: (res) => {
          const rows = res.data?.content ?? [];
          if (!rows.length) return;
          const lang = this.language.current();
          const bySlug = new Map(
            rows.map((r) => [
              r.slug,
              r.translations?.find((t) => t.language === lang)?.name ?? r.name ?? r.slug,
            ]),
          );
          const ordered = DashboardStatsService.ROAST_SLUG_ORDER.filter((slug) =>
            bySlug.has(slug),
          ).map((slug) => bySlug.get(slug)!);
          // Any roast level outside the canonical list still gets a place.
          for (const r of rows) {
            const name =
              r.translations?.find((t) => t.language === lang)?.name ?? r.name ?? r.slug;
            if (name && !ordered.includes(name)) ordered.push(name);
          }
          this._roastOrder.set(ordered);
        },
        error: () => {
          /* the ramp falls back to the order the data arrives in */
        },
      });
  }

  /**
   * The selected window, or the window before it.
   *
   * One definition of a window, shared by the toolbar, the KPI cards and the
   * export — so the label a reader sees is always the range the data was
   * actually fetched for.
   */
  window(which: 'current' | 'previous'): { start: Date; end: Date; days: number } {
    const days = this._days();
    return which === 'current'
      ? currentPeriod(days)
      : previousPeriod(days);
  }

  setDays(days: number) {
    this._days.set(days);
    this.fetchOverview();
  }

  refresh() {
    this.fetchOverview();
  }

  private fetchOverview() {
    this.loading.set(true);
    const days = this._days();

    // Dev-only mock mode: append ?mock=1 to the URL to preview the dashboard
    // with rich dummy data (useful for visual QA of populated states).
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mock') === '1') {
      setTimeout(() => {
        this._overview.set(this.getMockOverview(days));
        this._revenuePreviousPeriod.set(this.getMockRevenueByDay(days, true));
        this.loading.set(false);
      }, 300);
      return;
    }

    // TWO requests, TWO different date ranges.
    //
    // `overview/compare?days=N` looks like it returns the previous period,
    // but it does not: server-side `buildOverview(since, until, days)` drops
    // its `until` argument, so the `previous` object is "everything since
    // 2N days ago" — a superset of the current window. It is not used.
    //
    // Instead:
    //   current  = GET overview?days=N    (the selected window)
    //   span     = GET overview?days=2N   (the selected window + the one
    //                                        before it)
    // and the previous window's figures are `span - current`, which is exact
    // because every one of those aggregates is a plain sum over a lower
    // date bound. The two requests carry different `days` values, and
    // `fetchPlan` records the disjoint date range each is credited with.
    const plan = fetchPlan(days);
    this.lastPlan = plan;
    const requestId = ++this.requestId;

    forkJoin({
      current: this.http.get<ApiResponse<DashboardOverviewDto>>(
        `${this.baseUrl}/overview?days=${plan.current.days}`,
      ),
      span: this.http.get<ApiResponse<DashboardOverviewDto>>(
        `${this.baseUrl}/overview?days=${plan.previous.days}`,
      ),
    }).subscribe({
      next: ({ current, span }) => {
        // A stale response (an older range that answered late) is dropped.
        if (requestId !== this.requestId) return;
        this._overviewError.set(null);
        this.loaded.set(true);
        if (current.success && current.data) {
          const cur = current.data;
          const sp = span.success && span.data ? span.data : null;

          const previousRevenue = sp ? previousValue(sp.totalRevenue, cur.totalRevenue) : undefined;
          const previousOrders = sp ? previousValue(sp.totalOrders, cur.totalOrders) : undefined;
          const previousCoffeeKg = sp ? previousValue(sp.coffeeSoldKg, cur.coffeeSoldKg) : undefined;

          // AOV is a ratio, not a sum — it cannot be subtracted. It is
          // recomputed from the two derived components instead.
          const previousAov =
            previousRevenue !== undefined && previousOrders !== undefined && previousOrders > 0
              ? Math.round((previousRevenue / previousOrders) * 100) / 100
              : previousOrders === 0
                ? 0
                : undefined;

          this._overview.set({
            ...cur,
            previousTotalRevenue: previousRevenue,
            previousTotalOrders: previousOrders,
            previousAverageOrderValue: previousAov,
            previousCoffeeSoldKg: previousCoffeeKg,
          });

          // The comparison line for the revenue chart: the earlier half of
          // the 2N-day daily series, which is exactly the previous window.
          if (sp) {
            const series = sp.revenueByDay ?? [];
            const previousDays = series.slice(0, Math.max(0, series.length - days));
            this._revenuePreviousPeriod.set(previousDays);
          }
        }
        this.loading.set(false);
      },
      error: (err) => {
        if (requestId !== this.requestId) return;
        // The error is kept, not swallowed: the widgets that read the
        // overview show it, with a retry.
        this._overviewError.set(
          err?.error?.message ?? 'The dashboard data could not be loaded',
        );
        this.loaded.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Retry the overview after a failure. */
  retry(): void {
    this._overviewError.set(null);
    this.fetchOverview();
  }

  /** Dev-only mock overview with rich dummy data for visual QA. */
  private getMockOverview(days: number): DashboardOverviewDto {
    const revenueByDay = this.getMockRevenueByDay(days, false);
    return {
      totalRevenue: 12480.5,
      totalOrders: 142,
      averageOrderValue: 87.89,
      coffeeSoldKg: 64.2,
      userGrowth: { totalUsers: 320, currentPeriodCount: 48, previousPeriodCount: 35, growthPercentage: 37.1 },
      onlineUsersCount: 7,
      deviceBreakdown: [
        { deviceType: 'Desktop', count: 89 },
        { deviceType: 'Mobile', count: 42 },
        { deviceType: 'Tablet', count: 11 },
      ],
      revenueByDay,
      ordersByStatus: [
        { status: 'DELIVERED', count: 98 },
        { status: 'SHIPPED', count: 12 },
        { status: 'PROCESSING', count: 18 },
        { status: 'PENDING', count: 10 },
        { status: 'CANCELLED', count: 4 },
      ],
      revenueByCategory: [
        { categoryName: 'Single Origin', revenue: 5200.0, percentage: 41.7 },
        { categoryName: 'Blends', revenue: 3800.0, percentage: 30.5 },
        { categoryName: 'Equipment', revenue: 2100.0, percentage: 16.8 },
        { categoryName: 'Merchandise', revenue: 1380.5, percentage: 11.0 },
      ],
      topSellingProducts: [
        { id: 1, slug: 'ethiopian-yirgacheffe', name: 'Ethiopian Yirgacheffe', imageUrl: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800', price: 24.5, quantitySold: 86 },
        { id: 2, slug: 'colombian-supremo', name: 'Colombian Supremo', imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800', price: 22.0, quantitySold: 72 },
        { id: 3, slug: 'house-blend', name: 'House Blend', imageUrl: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800', price: 19.5, quantitySold: 64 },
        { id: 4, slug: 'kenyan-aa', name: 'Kenyan AA', imageUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800', price: 26.0, quantitySold: 41 },
        { id: 5, slug: 'pour-over-kit', name: 'Pour Over Kit', imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800', price: 45.0, quantitySold: 18 },
      ],
      revenueByOrigin: [
        { originName: 'Ethiopia', revenue: 5200.0, percentage: 41.7 },
        { originName: 'Colombia', revenue: 3800.0, percentage: 30.5 },
        { originName: 'Kenya', revenue: 2100.0, percentage: 16.8 },
        { originName: 'Brazil', revenue: 1380.5, percentage: 11.0 },
      ],
      revenueByRoastLevel: [
        { roastLevelName: 'Light', revenue: 3100.0, percentage: 24.8 },
        { roastLevelName: 'Medium', revenue: 5200.0, percentage: 41.7 },
        { roastLevelName: 'Dark', revenue: 4180.5, percentage: 33.5 },
      ],
      // Counts, not money: the card reads "<refunded> of <paid> orders",
      // so 320/11,800 printed "320 of 11800 orders".
      refundRate: { totalPaid: 142, totalRefunded: 4, refundRate: 2.8 },
      lowStockProducts: [
        { id: 10, slug: 'kenyan-aa', name: 'Kenyan AA', imageUrl: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800', stockQuantity: 3, reorderThreshold: 5 },
        { id: 11, slug: 'pour-over-kit', name: 'Pour Over Kit', imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800', stockQuantity: 1, reorderThreshold: 5 },
      ],
      ordersByPaymentMethod: [
        { paymentMethod: 'ONLINE', count: 104 },
        { paymentMethod: 'CASH_ON_DELIVERY', count: 38 },
      ],
      repeatPurchaseRate: { totalCustomers: 320, repeatCustomers: 128, repeatRate: 40.0 },
      previousTotalRevenue: 10920.0,
      previousTotalOrders: 128,
      previousAverageOrderValue: 85.31,
      previousCoffeeSoldKg: 58.4,
      pendingReviewsCount: 3,
      unreadContactMessagesCount: 2,
      storeCurrency: 'USD',
    };
  }

  private getMockRevenueByDay(days: number, previous: boolean): RevenueByDayDto[] {
    const out: RevenueByDayDto[] = [];
    const base = previous ? 320 : 400;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      // A deterministic jitter per DATE (not Math.random): the mock is for
      // visual QA, and a screenshot that changes on every reload cannot be
      // compared with the last one.
      let hash = 0;
      for (const ch of iso) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
      const jitter = (hash % 60) + (hash % 7);
      const rev = Math.round((base + Math.sin(i / 3) * 80 + jitter) * 100) / 100;
      out.push({ date: iso, revenue: Math.max(0, rev) });
    }
    return out;
  }
}