import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldAlert } from '@ng-icons/lucide';
import { DecimalPipe } from '@angular/common';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { PluralPipe } from '../../shared/pipes/plural.pipe';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { KpiCardComponent } from '../../shared/components/dashboard/kpi-card/kpi-card.component';
import { NeedsAttentionPanelComponent } from '../../shared/components/dashboard/needs-attention-panel/needs-attention-panel.component';
import { DeviceListComponent } from '../../shared/components/dashboard/device-list/device-list.component';
import { LowStockProductsComponent } from '../../shared/components/dashboard/low-stock-products/low-stock-products.component';
import { OrdersBreakdownCardComponent } from '../../shared/components/dashboard/orders-breakdown-card/orders-breakdown-card.component';
import { RecentOrdersComponent } from '../../shared/components/dashboard/recent-orders/recent-orders.component';
import { RevenueBreakdownCardComponent } from '../../shared/components/dashboard/revenue-breakdown-card/revenue-breakdown-card.component';
import { RevenueChartComponent } from '../../shared/components/dashboard/revenue-chart/revenue-chart.component';
import { TopProductsComponent } from '../../shared/components/dashboard/top-products/top-products.component';
import { WidgetHeaderComponent } from '../../shared/components/widget-header/widget-header.component';
import { WidgetStateComponent } from '../../shared/components/widget-state/widget-state.component';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardToolbarComponent } from '../../shared/components/dashboard/dashboard-toolbar/dashboard-toolbar.component';
import { StoreSettingsService } from '../../core/settings/store-settings.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    HlmButtonImports,
    HlmCardImports,
    NgIcon,
    DecimalPipe,
    MoneyPipe,
    PluralPipe,
    TranslocoPipe,
    KpiCardComponent,
    NeedsAttentionPanelComponent,
    DashboardToolbarComponent,
    DeviceListComponent,
    LowStockProductsComponent,
    OrdersBreakdownCardComponent,
    RecentOrdersComponent,
    RevenueBreakdownCardComponent,
    RevenueChartComponent,
    TopProductsComponent,
    WidgetHeaderComponent,
    WidgetStateComponent,
  ],
  providers: [provideIcons({ lucideShieldAlert })],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly statsService = inject(DashboardStatsService);
  readonly storeSettings = inject(StoreSettingsService);

  /** Every widget is gated by its own permission.  If the user lacks the
      specific permission the widget simply does not render — no empty card. */
  readonly canRevenue = this.auth.hasPermission('order:read');
  readonly canOrdersKPI = this.auth.hasPermission('order:read');
  readonly canTopSelling = this.auth.hasPermission('order:read');
  readonly canRecentOrders = this.auth.hasPermission('order:read');
  readonly canLowStock = this.auth.hasPermission('product:read');
  readonly canOnlineUsers = this.auth.hasPermission('dashboard:read');
  readonly canOperatingSystem = this.auth.hasPermission('dashboard:read');
  readonly canOpenOrders = this.auth.hasPermission('order:read');
  readonly canUnreadMessages = this.auth.hasPermission('contact:read');
  readonly canReviewsAwaiting = this.auth.hasPermission('review:read');

  /** Welcome state: shown when the user has dashboard:read but no widget
      permission is true.  Links go to the first page they can open. */
  readonly showWelcome = computed(() =>
    this.auth.hasPermission('dashboard:read') &&
    !this.canRevenue &&
    !this.canOrdersKPI &&
    !this.canTopSelling &&
    !this.canRecentOrders &&
    !this.canLowStock &&
    !this.canOnlineUsers
  );

  /** 403 page reads the denied slug from the URL (`/unauthorized?permission=<slug>`).
      If the user was redirected here from a protected route, show the slug. */
  readonly missingPermission = this.route.snapshot.queryParamMap.get('permission') ?? null;

  constructor() {
    // NOOP — the permission checks are computed lazily above.
  }
}