import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';

import { DashboardStatsService } from './services/dashboard-stats.service';
import { RevenueChartComponent } from '../../shared/components/dashboard/revenue-chart/revenue-chart.component';
import { CategoryChartComponent } from './category-chart/category-chart.component';
import { StatusChartComponent } from '../../shared/components/dashboard/status-chart/status-chart.component';
import { TopProductsComponent } from '../../shared/components/dashboard/top-products/top-products.component';
import { RecentOrdersComponent } from '../../shared/components/dashboard/recent-orders/recent-orders.component';
import { OnlineUsersComponent } from '../../shared/components/dashboard/online-users/online-users.component';


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
    CategoryChartComponent,
    TopProductsComponent,
    RecentOrdersComponent,
    OnlineUsersComponent,
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
    }),
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  protected readonly statsService = inject(DashboardStatsService);

  readonly filterOptions = [
    { label: 'Last 7 Days', value: 7 },
    { label: 'Last 30 Days', value: 30 },
    { label: 'Last 90 Days', value: 90 },
    { label: 'Last Year', value: 365 },
  ];

  readonly selectedDays = computed(() => this.statsService.days());

  onFilterChange(days: number) {
    this.statsService.setDays(days);
  }
}