/**
 * The shared "how many items are in this order" helper.
 *
 * ONE definition, used by the order details header, the orders list column
 * and the dashboard recent orders. A line's quantity is what counts, so
 * "3 items" means three units, not three lines.
 */
export function orderItemsCount(order: { items?: Array<{ quantity?: number }> } | null | undefined): number {
  if (!order?.items?.length) return 0;
  return order.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
}

/** The number of distinct lines (products) in the order. */
export function orderLinesCount(order: { items?: Array<unknown> } | null | undefined): number {
  return order?.items?.length ?? 0;
}