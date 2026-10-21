import type { OrderResponse } from '../models/order.model';

/**
 * The customer facts the order page shows next to the name.
 *
 * <p>The backend has no customer-aggregate endpoint, so these numbers are
 * computed from the customer's own orders (the list endpoint accepts a
 * `userId` filter). "Lifetime spend" counts PAID orders only: a refunded
 * order's net value is unknown because the refund amount is not recorded,
 * and including it would overstate what the customer spent.
 */
export interface CustomerSummary {
  /** Every order the customer has placed, whatever its status. */
  orderCount: number;
  /** The PAID orders behind `lifetimePaid`. */
  paidOrderCount: number;
  /** The sum of `totalAmount` over the PAID orders. */
  lifetimePaid: number;
}

/** Summarize a customer's orders. Pure: the list is the input, never a cache. */
export function summarizeCustomerOrders(orders: readonly OrderResponse[]): CustomerSummary {
  const paid = orders.filter((order) => order.paymentStatus === 'PAID');
  return {
    orderCount: orders.length,
    paidOrderCount: paid.length,
    lifetimePaid: round2(paid.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0)),
  };
}

function round2(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}
