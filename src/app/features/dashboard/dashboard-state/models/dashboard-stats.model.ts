export interface RevenueByDayDto {
  date: string;
  revenue: number;
}

export interface OrdersByStatusDto {
  status: string;
  count: number;
}
export interface DashboardOverviewDto {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueByDay: RevenueByDayDto[];
  ordersByStatus: OrdersByStatusDto[];
}
