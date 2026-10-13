export interface DashboardOverviewDto {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  coffeeSoldKg: number;
  userGrowth: UserGrowthDto;
  onlineUsersCount: number;
  deviceBreakdown: DeviceBreakdownDto[];
  revenueByDay: RevenueByDayDto[];
  ordersByStatus: OrdersByStatusDto[];
  revenueByCategory: RevenueByCategoryDto[];
  topSellingProducts: TopSellingProductDto[];
  revenueByOrigin: RevenueByOriginDto[];
  revenueByRoastLevel: RevenueByRoastLevelDto[];
  refundRate: RefundRateDto;
  lowStockProducts: LowStockProductDto[];
  ordersByPaymentMethod: OrdersByPaymentMethodDto[];
  repeatPurchaseRate: RepeatPurchaseRateDto;
}

export interface UserGrowthDto {
  totalUsers: number;
  currentPeriodCount: number;
  previousPeriodCount: number;
  growthPercentage: number;
}

export interface DeviceBreakdownDto {
  deviceType: string;
  count: number;
}

export interface RevenueByDayDto {
  date: string;
  revenue: number;
}

export interface OrdersByStatusDto {
  status: string;
  count: number;
}

export interface RevenueByCategoryDto {
  categoryName: string;
  revenue: number;
  percentage: number;
}

export interface TopSellingProductDto {
  id: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  quantitySold: number;
}

export interface RevenueByOriginDto {
  originName: string;
  revenue: number;
  percentage: number;
}

export interface RevenueByRoastLevelDto {
  roastLevelName: string;
  revenue: number;
  percentage: number;
}

export interface RefundRateDto {
  totalPaid: number;
  totalRefunded: number;
  refundRate: number;
}

export interface LowStockProductDto {
  id: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  stockQuantity: number;
}

export interface OrdersByPaymentMethodDto {
  paymentMethod: string;
  count: number;
}

export interface RepeatPurchaseRateDto {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
}
