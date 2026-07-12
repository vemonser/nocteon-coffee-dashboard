import { Component, OnInit, signal, inject } from '@angular/core';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { DashboardOverviewDto } from '../models/dashboard-stats.model';


import { DecimalPipe } from '@angular/common';
import { RevenueChartComponent } from '../../../../shared/components/dashboard/revenue-chart/revenue-chart.component';
import { OrdersStatusChartComponent } from '../../../../shared/components/dashboard/components/orders-status-chart.component';



@Component({
  selector: 'app-dashboard-overview',
  standalone: true,
  templateUrl: './dashboard-overview.component.html',
  imports: [RevenueChartComponent, DecimalPipe,OrdersStatusChartComponent],
})

export class DashboardOverviewComponent implements OnInit {
  private statsService = inject(DashboardStatsService);

  selectedRange = signal(30); // default شهر
  stats = signal<DashboardOverviewDto | null>(null);
  loading = signal(false);

  ngOnInit() {
    this.loadStats();
  }

  onRangeChange(days: number) {
    this.selectedRange.set(days);
    this.loadStats();
  }

  private loadStats() {
  this.loading.set(true);
  this.statsService.getOverview(this.selectedRange()).subscribe({
    next: (res) => {
      this.stats.set(res.data);
      this.loading.set(false);
    },
    error: () => this.loading.set(false),
  });
}



}
