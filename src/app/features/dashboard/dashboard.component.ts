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
  lucideCheck,
  lucideDownload,
  lucideInfo,
  lucideMinus,
  lucidePlus,
  lucidePercent,
  lucideArchive,
  lucideFileText,
  lucideXCircle as lucideXCircle2,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';


import { DashboardStatsService } from './services/dashboard-stats.service';
import { StoreSettingsService } from '../../core/settings/store-settings.service';
import { LanguageService } from '../../core/i18n/language.service';
import { computeDelta, type DeltaResult } from '../../core/dashboard/delta';
import { periodPair } from '../../core/dashboard/period';
import { formatCount, formatSignedPercent } from '../../shared/utils/locale-format';
import {
  DASHBOARD_ORDER_SCOPE,
  orderScopeDefinition,
} from '../../core/dashboard/order-scope';
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
    WidgetStateComponent,
    KpiCardComponent,
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
      lucideCheck,
      lucideMinus,
      lucidePlus,
      lucidePercent,
      lucideArchive,
      lucideFileText,
      lucideXCircle2,
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


  /**
   * What the order-derived counts cover.
   *
   * One shared definition (core/dashboard/order-scope.ts), so the dashboard
   * and the Orders page say the same thing about the same number.
   */
  protected readonly orderScopeHelp = computed(() => {
    this.language.language();
    return this.transloco.translate(
      orderScopeDefinition(DASHBOARD_ORDER_SCOPE).helpKey,
    );
  });


  readonly selectedDays = computed(() => this.statsService.days());

  readonly repeatPurchaseRate = computed(() => this.statsService.repeatPurchaseRate());
  readonly refundRate = computed(() => this.statsService.refundRate());
  readonly deviceBreakdown = computed(() => [...(this.statsService.deviceBreakdown() ?? [])].sort((a, b) => (b.count || 0) - (a.count || 0)));
  readonly lowStockProducts = computed(() => this.statsService.lowStockProducts() ?? []);
  readonly onlineUsersCount = computed(() => this.statsService.onlineUsers());
  readonly paidOrders = computed(() => this.statsService.paidOrders());

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




  /** Delta result for a KPI card. */

  /** A whole number, formatted for the current locale. */
  /** Retry the overview after a failure. */
  protected readonly retryOverview = () => this.statsService.retry();

  /** Counts are whole numbers, from the SHARED count formatter. */
  protected fmtCount = (value: number | undefined | null): string =>
    formatCount(value ?? 0, this.language.language());

  protected readonly delta = computed(() => {
    const stats = this.statsService.statsCards();
    const overview = this.statsService.overview();
    const ug = this.statsService.userGrowth();
    if (!stats || !ug || !overview) return {};
    return {
      revenue: computeDelta(stats.totalRevenue, overview.previousTotalRevenue, 'revenue'),
      orders: computeDelta(stats.totalOrders, overview.previousTotalOrders, 'orders'),
      customers: computeDelta(ug.currentPeriodCount, ug.previousPeriodCount, 'customers'),
      coffee: computeDelta(stats.coffeeSold, overview.previousCoffeeSoldKg, 'coffee'),
      aov: computeDelta(stats.averageOrderValue, overview.previousAverageOrderValue, 'aov'),
    };
  });

  /**
   * The delta chip's label.
   *
   * A zero change reads "No change", not "+0.0%" with a green arrow: there
   * was no change. TONE 'new' is removed per T1 requirements.
   */
  protected deltaLabel(d: DeltaResult | null | undefined): string {
    if (!d) return '—';
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
