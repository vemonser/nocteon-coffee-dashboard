import type { OrderResponse } from '../models/order.model';
import type { OrderPaymentDetails } from '../models/order-activity.model';

/**
 * What the store says has been paid, refunded and is still owed.
 *
 * <p>Every number is either RECORDED by the backend or `null` — never a
 * guess. The backend has no per-order refund entity until a refund is
 * issued, and a REFUNDED order with no refund line therefore has an
 * UNKNOWN refunded amount: showing 0 would claim the customer got nothing
 * back, and showing the total would claim they got everything back.
 */
export interface OrderSettlement {
  /** What was collected. Null when the store does not record it. */
  paid: number | null;
  /** What went back. Null when the payment is REFUNDED with no refund line. */
  refunded: number | null;
  /** Total − paid − refunded. Null while either input is unknown. */
  balanceDue: number | null;
  /** A PAID order with no paid-at time (or no reference on an online payment). */
  incompletePayment: boolean;
  missingPaidAt: boolean;
  missingReference: boolean;
  /** A REFUNDED order with no refund line, so the amount is unknown. */
  refundedWithoutLine: boolean;
}

/** Two decimals, without float noise. */
function money2(value: number): number {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

/**
 * The settlement of an order, derived ONLY from recorded fields.
 *
 * <p>The rules, in one place:
 * <ul>
 *   <li>PAID → the payment's amount, else the order total.</li>
 *   <li>REFUNDED → the payment's amount (the backend returns what is left
 *       paid, which can be 0) and the refund lines; with no refund line the
 *       refunded amount is unknown.</li>
 *   <li>Any status whose payment detail has not loaded → the refunded amount
 *       is unknown (only PENDING/FAILED are known to be 0).</li>
 *   <li>PENDING / FAILED → nothing has been collected.</li>
 *   <li>A CANCELLED order owes nothing, even when it was never paid.</li>
 * </ul>
 */
export function computeSettlement(
  order: OrderResponse | null | undefined,
  payment: OrderPaymentDetails | null | undefined,
): OrderSettlement {
  const total = money2(order?.totalAmount ?? 0);
  const paymentStatus = order?.paymentStatus ?? payment?.status ?? null;
  const method = order?.paymentMethod ?? payment?.method ?? null;

  const refunds = payment?.refunds ?? [];
  const refundsTotal = money2(refunds.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0));
  const refundedWithoutLine = paymentStatus === 'REFUNDED' && refunds.length === 0;

  // The refunds are UNKNOWN until the payment detail has arrived: while the
  // request is in flight (or if it failed) `payment` is null, and rendering 0
  // would claim that nothing was ever given back. The one exception is a
  // payment that never happened — PENDING/FAILED cannot have a refund.
  let refunded: number | null;
  if (paymentStatus === 'PENDING' || paymentStatus === 'FAILED') {
    refunded = 0;
  } else if (payment === null || payment === undefined) {
    refunded = null;
  } else if (refundedWithoutLine) {
    refunded = null;
  } else {
    refunded = refundsTotal;
  }

  let paid: number | null;
  if (paymentStatus === 'PAID') {
    paid = money2(payment?.amount ?? total);
  } else if (paymentStatus === 'REFUNDED') {
    paid = payment?.amount === null || payment?.amount === undefined ? null : money2(payment.amount);
  } else {
    paid = 0;
  }

  let balanceDue: number | null;
  if (order?.status === 'CANCELLED') {
    balanceDue = 0;
  } else if (refunded === null || paid === null) {
    balanceDue = null;
  } else {
    balanceDue = money2(Math.max(0, total - paid - refunded));
  }

  const missingPaidAt = paymentStatus === 'PAID' && !payment?.paidAt;
  // Cash is collected at the door: there is no gateway reference to record.
  const missingReference =
    paymentStatus === 'PAID' && method === 'ONLINE' && !payment?.transactionReference;

  return {
    paid,
    refunded,
    balanceDue,
    incompletePayment: missingPaidAt || missingReference,
    missingPaidAt,
    missingReference,
    refundedWithoutLine,
  };
}
