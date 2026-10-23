import { Component, inject } from '@angular/core';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { RevenueChartComponent } from '../../../../shared/components/dashboard/revenue-chart/revenue-chart.component';
import { OrdersStatusChartComponent } from '../../../../shared/components/dashboard/components/orders-status-chart.component';

import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';
@Component({
  selector: 'app-dashboard-overview',
  standalone: true,
  templateUrl: './dashboard-overview.component.html',
  imports: [RevenueChartComponent, OrdersStatusChartComponent, TranslocoPipe, MoneyPipe,
  ],
})
export class DashboardOverviewComponent {
  protected readonly statsService = inject(DashboardStatsService);

  onRangeChange(days: number) {
    this.statsService.setDays(days);
  }
}