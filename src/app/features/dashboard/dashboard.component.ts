import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldAlert } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardStatsService } from './services/dashboard-stats.service';
import { KpiCardComponent } from '../../shared/components/dashboard/kpi-card/kpi-card.component';
import { NeedsAttentionPanelComponent } from '../../shared/components/dashboard/needs-attention-panel/needs-attention-panel.component';
import { WidgetHeaderComponent } from '../../shared/components/widget-header/widget-header.component';
import { firstAllowedRouteFor } from '../../core/auth/permission-routes';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    HlmButtonImports,
    NgIcon,
    TranslocoPipe,
    KpiCardComponent,
    NeedsAttentionPanelComponent,
    WidgetHeaderComponent,
  ],
  providers: [provideIcons({ lucideShieldAlert })],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly statsService = inject(DashboardStatsService);

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

  /** First page the reader may open, used by the welcome state. */
  readonly welcomeTarget = computed(() =>
    firstAllowedRouteFor(this.auth.currentUser() as any)
  );

  /** 403 page reads the denied slug from the URL (`/unauthorized?permission=<slug>`).
      If the user was redirected here from a protected route, show the slug. */
  readonly missingPermission = this.route.snapshot.queryParamMap.get('permission') ?? null;

  constructor() {
    // NOOP — the permission checks are computed lazily above.
  }
}