import type { OrderResponse } from '../models/order.model';

/**
 * The order totals breakdown.
 *
 * The BACKEND is the single source of truth for the total: `orders.total_amount`
 * is stored at creation and returned verbatim. This module does not re-derive
 * the total for display — it reports the stored one, and it REPORTS the
 * subtotal it can derive from the items so a disagreement is visible instead
 * of hidden.
 *
 * Why a disagreement can exist: the seed migration writes `total_amount` by
 * hand, independently of the `order_items` rows of the same order. The
 * runtime formula (backend `OrderService.createOrder`) is
 *
 *     total = (sum of item prices - discount) + shipping
 *
 * and it is correct. So a mismatch means the DATA is wrong, not the
 * formula — and the UI says so rather than silently showing one number.
 */
export interface OrderTotals {
  /** The sum of the item line totals — what the items add up to. */
  subtotal: number;
  /** `orders.shipping_cost`. */
  shipping: number;
  /** `orders.discount_amount`. */
  discount: number;
  /**
   * Tax. The backend has NO tax concept at all (no column, no field, no
   * calculation), so this is always 0 and is rendered as a line that is only
   * shown when a tax ever exists. See ORDERS_CONTRACT.md.
   */
  tax: number;
  /** `orders.total_amount` — the backend's stored total. The number of record. */
  total: number;
  /**
   * What the total SHOULD be, from the items: subtotal - discount + shipping.
   */
  expectedTotal: number;
  /**
   * Net paid — the total minus refunds.
   *
   * `null` when it cannot be known: a refunded order carries the payment
   * status REFUNDED but NO refund amount (there is no refund entity in the
   * backend), so the money actually returned to the customer is unknown.
   * `null` is shown as such — never as 0, which would claim a full refund.
   */
  netPaid: number | null;
  /** `total - expectedTotal`. Zero when the stored total agrees with the items. */
  delta: number;
  /** True when the stored total agrees with the items. */
  consistent: boolean;
  /** True when the order carries a refund whose amount is not known. */
  refundAmountUnknown: boolean;
}

/**
 * Two decimals, without the float noise of `0.1 + 0.2`.
 *
 * `-0` is normalised to `0`: `Intl.NumberFormat` renders it as "-0", which
 * would put a minus sign in front of a zero on an order row.
 */
export function money2(value: number): number {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

/**
 * The totals breakdown of an order.
 *
 * A pure function of the API response: the same order always produces the
 * same breakdown, and the breakdown never depends on the UI language, the
 * currency or the page it is rendered on.
 */
export function computeOrderTotals(order: OrderResponse | null | undefined): OrderTotals {
  const items = order?.items ?? [];

  // The subtotal comes from the items' OWN line totals. When an item's line
  // total disagrees with unit price x quantity, the line total wins (it is
  // what the backend stored) and the disagreement is reported by
  // `lineTotalsAgree` below.
  const subtotal = money2(
    items.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0),
  );
  const shipping = money2(order?.shippingCost ?? 0);
  const discount = money2(order?.discountAmount ?? 0);
  const tax = 0;
  const total = money2(order?.totalAmount ?? 0);
  const expectedTotal = money2(subtotal - discount + shipping + tax);
  const delta = money2(total - expectedTotal);

  const refundAmountUnknown = order?.paymentStatus === 'REFUNDED';

  return {
    subtotal,
    shipping,
    discount,
    tax,
    total,
    expectedTotal,
    netPaid: refundAmountUnknown ? null : total,
    delta,
    consistent: delta === 0,
    refundAmountUnknown,
  };
}

/**
 * Do the item line totals agree with unit price x quantity?
 *
 * They normally do. When they do not, the order's own line is inconsistent
 * and the detail page says so.
 */
export function lineTotalsAgree(order: OrderResponse | null | undefined): boolean {
  const items = order?.items ?? [];
  return items.every(
    (item) => money2(Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0)) === money2(item.totalPrice),
  );
}
