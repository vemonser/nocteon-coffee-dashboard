/**
 * ONE shared definition of "open orders" used by both the dashboard and the
 * orders list. Open orders = paid orders whose status is in PENDING,
 * PROCESSING, or SHIPPED (excluding cancelled and delivered).
 */
export function isOpenOrderStatus(status: string): boolean {
  return status === 'PENDING' || status === 'PROCESSING' || status === 'SHIPPED';
}

export function openOrdersCount(statusCounts: Record<string, number>): number {
  return (statusCounts['PENDING'] ?? 0) +
    (statusCounts['PROCESSING'] ?? 0) +
    (statusCounts['SHIPPED'] ?? 0);
}