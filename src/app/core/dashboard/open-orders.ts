import { OPEN_STATUSES } from '../../features/orders/utils/order-filters';

/**
 * ONE shared definition of "open orders" used by both the dashboard and the
 * orders list. Open orders = orders whose status is in OPEN_STATUSES
 * (PENDING, CONFIRMED, PROCESSING, SHIPPED).
 */
export function isOpenOrderStatus(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

export function openOrdersCount(statusCounts: Record<string, number>): number {
  return OPEN_STATUSES.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0);
}
