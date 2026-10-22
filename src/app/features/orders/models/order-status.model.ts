import type { OrderStatus, PaymentMethod, PaymentStatus } from './order.model';
import type { StatusKind } from '../../../shared/ui/status-badge/status-badge.component';

/**
 * THE order status model.
 *
 * One list of statuses, one list of transitions, one mapping to a badge
 * kind. The list page, the detail page, the status dialog, the timeline and
 * the export all read from here, so a status can never mean two things in
 * two places.
 *
 * The backend owns the enums:
 *   - `order.enums.OrderStatus`  — PENDING, CONFIRMED, PROCESSING, SHIPPED,
 *     DELIVERED, CANCELLED
 *   - `payment.enums.PaymentStatus` — PENDING, PAID, FAILED, REFUNDED
 *   - `payment.enums.PaymentMethod` — ONLINE, CASH_ON_DELIVERY
 *
 * "Refunded" is a PAYMENT status (a flag), not an order status: a refunded
 * order keeps the fulfilment status it reached.
 */

/** The canonical order status list, in the order the fulfilment runs. */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

/** The payment status list. */
export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'NOT_COLLECTED',
];

/** The payment method list. */
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['ONLINE', 'CASH_ON_DELIVERY'];

/**
 * The transitions the backend's strict state machine allows.
 *
 * Source: `order/service/OrderStatusService.ALLOWED_TRANSITIONS`.
 *
 * NOTE: the endpoint the dashboard actually calls
 * (`PUT /api/dashboard/orders/{id}/status` -> `OrderService.updateStatus`)
 * does NOT use this map — it only refuses a change when the CURRENT status
 * is DELIVERED or CANCELLED, so it would accept PENDING -> DELIVERED. The
 * UI offers only the strict transitions, so it can never ask for a change the
 * intended contract forbids. The backend gap is written up in
 * ORDERS_CONTRACT.md.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** The fulfilment chain the progress tracker draws. */
export const FULFILMENT_CHAIN: readonly OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
];

/** A status no transition leaves: the order is finished, one way or another. */
export function isTerminal(status: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

/** The statuses that may be selected from `status`. */
export function nextStatuses(status: OrderStatus): readonly OrderStatus[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
}

/** Can the order move from `from` to `to`? */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * The order status -> badge kind.
 *
 * The colours are the ticket's semantic mapping:
 *   Pending   = warning
 *   Confirmed = info (soft)
 *   Processing = info
 *   Shipped   = chart-5 (slate)
 *   Delivered = success
 *   Cancelled = destructive-text
 */
export function orderStatusKind(status: OrderStatus): StatusKind {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'CONFIRMED':
      return 'confirmed';
    case 'PROCESSING':
      return 'processing';
    case 'SHIPPED':
      return 'shipped';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

/**
 * The payment status -> badge kind.
 *
 *   Paid = success, Pending = warning, Failed = destructive, Refunded = muted
 */
export function paymentStatusKind(status: PaymentStatus): StatusKind {
  switch (status) {
    case 'PAID':
      return 'paid';
    case 'PENDING':
      return 'pending';
    case 'FAILED':
      return 'failed';
    case 'REFUNDED':
      return 'refunded';
    default:
      return 'unknown';
  }
}

/**
 * The payment status -> badge kind.
 *
 *   Paid = success, Pending = warning, Failed = destructive, Refunded = muted,
 *   Not Collected = muted
 */
export function paymentStatusKind(status: PaymentStatus): StatusKind {
  switch (status) {
    case 'PAID':
      return 'paid';
    case 'PENDING':
      return 'pending';
    case 'FAILED':
      return 'failed';
    case 'REFUNDED':
      return 'refunded';
    case 'NOT_COLLECTED':
      return 'notCollected';
    default:
      return 'unknown';
  }
}

/**
 * Can this order still change status?
 */
export function canChangeStatus(order: { status: OrderStatus }): boolean {
  return nextStatuses(order.status).length > 0;
}

/**
 * Can this order still be cancelled?
 */
export function canCancel(order: { status: OrderStatus }): boolean {
  return nextStatuses(order.status).includes('CANCELLED');
}

/**
 * Can money go back? Only a payment the store marks PAID.
 */
export function canRefund(order: { paymentStatus: PaymentStatus }): boolean {
  return order.paymentStatus === 'PAID';
}

/**
 * The effective payment status for display.
 * Cancelled COD orders with PENDING/FAILED payment status show as NOT_COLLECTED.
 */
export function effectivePaymentStatus(order: { status: OrderStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus }): PaymentStatus {
  if (order.status === 'CANCELLED' && order.paymentMethod === 'CASH_ON_DELIVERY' &&
      (order.paymentStatus === 'PENDING' || order.paymentStatus === 'FAILED')) {
    return 'NOT_COLLECTED';
  }
  return order.paymentStatus;
}

/** The payment method -> a stable key for the i18n lookup. */
export function paymentMethodKey(method: PaymentMethod): string {
  return method;
}
