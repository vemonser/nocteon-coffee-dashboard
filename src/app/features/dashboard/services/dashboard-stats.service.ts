import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { DashboardOverviewDto } from '../model/DashboardOverviewDto';

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardStatsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/dashboard/stats`;

  private _days = signal<number>(30);
  readonly days = this._days.asReadonly();

  private _overview = signal<DashboardOverviewDto | null>(null);
  readonly loading = signal(false);

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

  constructor() {
    this.fetchOverview();
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
    this.http
      .get<ApiResponse<DashboardOverviewDto>>(`${this.baseUrl}/overview?days=${this._days()}`)
      .subscribe({
        next: (res) => {
          if (res.success) this._overview.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
