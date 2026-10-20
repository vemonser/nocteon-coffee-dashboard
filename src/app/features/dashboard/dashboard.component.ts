import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendar,
  lucideTrendingUp,
  lucideTrendingDown,
  lucideDollarSign,
  lucideShoppingCart,
  lucideUsers,
  lucideCoffee,
  lucidePackage,
  lucideAlertTriangle,
  lucideRefreshCw,
  lucideCreditCard,
  lucideRepeat,
  lucideGlobe,
  lucideFlame,
  lucideLineChart,
  lucidePieChart,
  lucideMonitor,
  lucideSmartphone,
  lucideTablet,
  lucideCheckCircle,
  lucideDownload,
  lucideInfo,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';

import { DashboardStatsService } from './services/dashboard-stats.service';
import { StoreSettingsService } from '../../core/settings/store-settings.service';
import { LanguageService } from '../../core/i18n/language.service';
import { computeDelta, type DeltaResult } from '../../core/dashboard/delta';
import { periodPair } from '../../core/dashboard/period';
import { formatSignedPercent } from '../../shared/utils/locale-format';
import { ORDER_COUNT_SCOPES } from '../../core/dashboard/order-scope';
import { RevenueChartComponent } from '../../shared/components/dashboard/revenue-chart/revenue-chart.component';
import { TopProductsComponent } from '../../shared/components/dashboard/top-products/top-products.component';
import { RecentOrdersComponent } from '../../shared/components/dashboard/recent-orders/recent-orders.component';
import { NeedsAttentionPanelComponent } from '../../shared/components/dashboard/needs-attention-panel/needs-attention-panel.component';
import { LowStockProductsComponent } from '../../shared/components/dashboard/low-stock-products/low-stock-products.component';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { PluralPipe } from '../../shared/pipes/plural.pipe';
import { WidgetHeaderComponent } from '../../shared/components/widget-header/widget-header.component';
import { RevenueBreakdownCardComponent } from '../../shared/components/dashboard/revenue-breakdown-card/revenue-breakdown-card.component';
import { OrdersBreakdownCardComponent } from '../../shared/components/dashboard/orders-breakdown-card/orders-breakdown-card.component';
import { DeviceListComponent } from '../../shared/components/dashboard/device-list/device-list.component';
import { DashboardToolbarComponent } from '../../shared/components/dashboard/dashboard-toolbar/dashboard-toolbar.component';
import { KpiCardComponent } from '../../shared/components/dashboard/kpi-card/kpi-card.component';
import { WidgetStateComponent } from '../../shared/components/widget-state/widget-state.component';
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIcon,
    HlmButtonImports,
    HlmCardImports,
    HlmBadgeImports,
    RevenueChartComponent,
    TopProductsComponent,
    RecentOrdersComponent,
    NeedsAttentionPanelComponent,
    LowStockProductsComponent,
    TranslocoPipe,
    MoneyPipe,
    PluralPipe,
    WidgetHeaderComponent,
    RevenueBreakdownCardComponent,
    OrdersBreakdownCardComponent,
    DeviceListComponent,
    DashboardToolbarComponent,
    KpiCardComponent,
    WidgetStateComponent,
  ],
  providers: [
    provideIcons({
      lucideCalendar,
      lucideTrendingUp,
      lucideTrendingDown,
      lucideDollarSign,
      lucideShoppingCart,
      lucideUsers,
      lucideCoffee,
      lucidePackage,
      lucideAlertTriangle,
      lucideRefreshCw,
      lucideCreditCard,
      lucideRepeat,
      lucideGlobe,
      lucideFlame,
      lucideLineChart,
      lucidePieChart,
      lucideMonitor,
      lucideSmartphone,
      lucideTablet,
      lucideCheckCircle,
      lucideDownload,
  lucideInfo,
    }),
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  protected readonly statsService = inject(DashboardStatsService);
  protected readonly storeSettings = inject(StoreSettingsService);
  private readonly transloco = inject(TranslocoService);
  protected readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly filterOptions = [
    { label: 'Last 7 Days', value: 7 },
    { label: 'Last 30 Days', value: 30 },
    { label: 'Last 90 Days', value: 90 },
    { label: 'Last Year', value: 365 },
  ];

  /**
   * The selected window and the window before it.
   *
   * Both come from `core/dashboard/period`, the single place that knows how a
   * window is defined: half-open [start, end), the same number of days in
   * each, and no overlap. The old inline calculation produced a 31-day
   * window for a "30 days" label and let the two windows share a day.
   */
  readonly periods = computed(() => periodPair(this.statsService.days()));

  readonly currentRange = computed(() => this.periods().current);
  readonly previousRange = computed(() => this.periods().previous);

  /** Format a date as "16 Sep" in current locale. */
  fmtRangeDate(d: Date): string {
    const locale = this.language.current() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(d);
  }

  /**
   * What the order-derived counts cover.
   *
   * One shared definition (core/dashboard/order-scope.ts), so the dashboard
   * and the Orders page say the same thing about the same number.
   */
  protected readonly orderScopeHelp = computed(() =>
    this.transloco.translate(ORDER_COUNT_SCOPES.paid.helpKey),
  );

  /** Last day of a window (its end is exclusive). */
  lastDayOf(window: { end: Date }): Date {
    return new Date(window.end.getTime() - 24 * 60 * 60 * 1000);
  }

  readonly selectedDays = computed(() => this.statsService.days());

  readonly repeatPurchaseRate = computed(() => this.statsService.repeatPurchaseRate());
  readonly refundRate = computed(() => this.statsService.refundRate());
  readonly deviceBreakdown = computed(() => [...(this.statsService.deviceBreakdown() ?? [])].sort((a, b) => (b.count || 0) - (a.count || 0)));
  readonly lowStockProducts = computed(() => this.statsService.lowStockProducts() ?? []);
  readonly onlineUsersCount = computed(() => this.statsService.onlineUsers());

  ngOnInit(): void {
    // The range lives in the URL, so it survives a refresh, a shared link
    // and the browser's BACK button.
    this.readDaysFromUrl(this.route.snapshot.queryParamMap.get('days'));

    // ...and it keeps following the URL: the back/forward buttons change the
    // range, so the page has to follow them.
    this.route.queryParamMap.subscribe((params) => {
      const days = this.readDaysFromUrl(params.get('days'));
      if (days !== undefined && days !== this.statsService.days()) {
        this.statsService.setDays(days);
      }
    });
  }

  /**
   * Read the range from the URL. Returns the clamped value, or undefined
   * when the URL does not carry one.
   */
  private readDaysFromUrl(raw: string | null): number | undefined {
    if (raw === null) return undefined;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.max(7, Math.min(365, parsed));
  }

  onFilterChange(days: number) {
    this.statsService.setDays(days);
    this.syncUrl(days);
  }

  goTo(route: string, queryParams?: Record<string, string>): void {
    this.router.navigate([route], { queryParams });
  }

  /** Sync selected days to URL (?days=30). */
  private syncUrl(days: number): void {
    this.router.navigate([], {
      queryParams: { days },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Title-case label for a device type (e.g. "ios" -> "Ios" is not ideal but matches data). */
  deviceLabel(deviceType: string): string {
    const t = (deviceType || '').toLowerCase();
    const map: Record<string, string> = { ios: 'iOS', mac: 'macOS', macos: 'macOS', android: 'Android', windows: 'Windows', linux: 'Linux', other: 'Other' };
    return map[t] ?? (t.charAt(0).toUpperCase() + t.slice(1));
  }

  /** Percentage of total device count for a single device type. */
  devicePercent(d: { count: number }): number {
    const total = this.deviceBreakdown().reduce((s, x) => s + (x.count || 0), 0);
    if (!total) return 0;
    return (d.count / total) * 100;
  }

  /** Export current overview as CSV. */
  exportCsv(): void {
    const overview = this.statsService.overview();
    if (!overview) return;
    const rows: string[] = [];
    rows.push('Metric,Value');
    rows.push(`Total Revenue,${overview.totalRevenue}`);
    rows.push(`Total Orders,${overview.totalOrders}`);
    rows.push(`Average Order Value,${overview.averageOrderValue}`);
    rows.push(`Coffee Sold (kg),${overview.coffeeSoldKg}`);
    rows.push(`New Customers,${overview.userGrowth.currentPeriodCount}`);
    rows.push(`Repeat Purchase Rate,${overview.repeatPurchaseRate.repeatRate}`);
    rows.push(`Refund Rate,${overview.refundRate.refundRate}`);
    rows.push('');
    rows.push('Top Products,Units Sold,Price');
    for (const p of overview.topSellingProducts) {
      rows.push(`"${p.name}",${p.quantitySold},${p.price}`);
    }
    const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nocteon-analytics-${this.statsService.days()}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Delta result for a KPI card. */
  /**
   * The daily revenue series, for the revenue KPI's sparkline.
   *
   * It is the REAL series the API returned — the same one the revenue chart
   * draws. A KPI card that faked its sparkline would be a decoration.
   */
  readonly revenueSparkline = computed(() =>
    (this.statsService.revenueChartData() ?? []).map((d) => d.revenue || 0),
  );

  /** A whole number, formatted for the current locale. */
  /** Retry the overview after a failure. */
  protected readonly retryOverview = () => this.statsService.retry();

  protected fmtCount = (value: number | undefined | null): string =>
    new Intl.NumberFormat(
      this.language.current() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US',
      { maximumFractionDigits: 0 },
    ).format(value ?? 0);

  protected readonly delta = computed(() => {
    const stats = this.statsService.statsCards();
    const overview = this.statsService.overview();
    const ug = this.statsService.userGrowth();
    if (!stats || !ug || !overview) return {};
    return {
      revenue: computeDelta(stats.totalRevenue, overview.previousTotalRevenue),
      orders: computeDelta(stats.totalOrders, overview.previousTotalOrders),
      customers: computeDelta(ug.currentPeriodCount, ug.previousPeriodCount),
      coffee: computeDelta(stats.coffeeSold, overview.previousCoffeeSoldKg),
      aov: computeDelta(stats.averageOrderValue, overview.previousAverageOrderValue),
    };
  });

  /**
   * The delta chip's label.
   *
   * A zero change reads "No change", not "+0.0%" with a green arrow: there
   * was no change, and a green up-arrow claims there was. "New" is used when
   * there is no baseline to compare against.
   */
  protected deltaLabel(d: DeltaResult | null | undefined): string {
    if (!d) return '—';
    if (d.tone === 'new') return this.t('dashboard.delta.new');
    if (d.tone === 'flat') return this.t('dashboard.delta.noChange');
    if (d.tone === 'none') return '—';
    const pct = formatSignedPercent(d.percent ?? 0, this.language.language());
    return pct;
  }

  /** Tone -> CSS colour class for the chip. */
  protected deltaToneClass(d: DeltaResult | null | undefined): string {
    if (!d) return 'text-muted-foreground';
    switch (d.tone) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-destructive';
      case 'new':
        return 'text-success';
      default:
        return 'text-muted-foreground';
    }
  }

  /** The arrow is only drawn for a real increase or decrease. */
  protected deltaArrow(d: DeltaResult | null | undefined): 'up' | 'down' | null {
    if (!d) return null;
    if (d.tone === 'up') return 'up';
    if (d.tone === 'down') return 'down';
    return null;
  }

  private t(key: string): string {
    return this.transloco.translate(key) || key;
  }
}
