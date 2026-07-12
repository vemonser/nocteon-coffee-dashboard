export interface DashboardOverviewDto {
  averageOrderValue: number;
  coffeeSoldKg: number;
  deviceBreakdown: { count: number; deviceType: string }[];
  onlineUsersCount: number;
  ordersByStatus: { status: string; count: number }[];
  revenueByCategory: { category: string; revenue: number }[];
  revenueByDay: { date: string; revenue: number }[];
  topSellingProducts: { name: string; sold: number; revenue: number; imageUrl?: string }[];
  totalOrders: number;
  totalRevenue: number;
  userGrowth: {
    currentPeriodCount: number;
    growthPercentage: number;
    previousPeriodCount: number;
    totalUsers: number;
  };
}