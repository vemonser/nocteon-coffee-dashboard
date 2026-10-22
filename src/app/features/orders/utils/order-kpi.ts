import type { OrderStatsResponse } from '../models/order.model';
import type { OrderStatus, PaymentStatus } from '../models/order.model';

/**
 * The KPI values shown in the four cards on the orders list.
 */
export interface KpiValues {
  /** Revenue net of refunds (from backend stats). */
  revenue: number;
  /** Open orders = Pending + Confirmed + Processing + Shipped (from status counts). */
  openCount: number;
  /** Average order value = revenue / revenueOrderCount. */
  avgOrderValue: number;
  /** Cancel rate = cancelled / filteredTotal (as percentage). */
  cancelRate: number;
}

/**
 * Compute the four KPI values from the backend stats and the status counts.
 *
 * @param stats The stats response for the CURRENT VIEW (with the selected tab)
 * @param statusCounts The status counts for the FILTERED SET (without the tab)
 * @param filteredTotal The total orders in the filtered set (without the tab)
 */
export function computeKpi(
  stats: OrderStatsResponse,
  statusCounts: Record<string, number>,
  filteredTotal: number
): KpiValues {
  const revenue = stats.revenue ?? 0;
  const revenueCount = stats.revenueOrderCount ?? 0;

  const openCount =
    (statusCounts['PENDING'] ?? 0) +
    (statusCounts['CONFIRMED'] ?? 0) +
    (statusCounts['PROCESSING'] ?? 0) +
    (statusCounts['SHIPPED'] ?? 0);

  const avgOrderValue = revenueCount > 0 ? revenue / revenueCount : 0;

  const cancelledCount = statusCounts['CANCELLED'] ?? 0;
  const cancelRate = filteredTotal > 0 ? (cancelledCount / filteredTotal) * 100 : 0;

  return {
    revenue,
    openCount,
    avgOrderValue,
    cancelRate,
  };
}

/**
 * Map a tab identifier to the API parameters for the stats call.
 *
 * @param tab The selected tab ('ALL', OrderStatus, or 'REFUNDED')
 * @returns Object with the API parameters for the stats endpoint
 */
export function tabToApiParams(
  tab: OrderStatus | 'ALL' | 'REFUNDED'
): { status?: OrderStatus; paymentStatus?: PaymentStatus } {
  if (tab === 'REFUNDED') {
    return { paymentStatus: 'REFUNDED' };
  }
  if (tab === 'ALL') {
    return {};
  }
  return { status: tab };
}