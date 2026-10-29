import type { OrderStatus, PaymentMethod, PaymentStatus } from './order.model';

/** One step of an order's status history. */
export interface OrderStatusHistoryEntry {
  id: number;
  orderId: number;
  /** Null for the first row: the order was placed, it came from nowhere. */
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  /** Who moved it: the e-mail of the admin, or the system. */
  changedBy: string | null;
  notifyCustomer: boolean;
  /**
   * Set when the row is an EVENT, not a status change — a return's request,
   * approval or rejection (`RETURN_REQUESTED`, `RETURN_APPROVED`,
   * `RETURN_REJECTED`). Null for a status change.
   *
   * <p>A row with an eventType must NOT be read as a transition: `fromStatus`
   * is null and `toStatus` is the order's status at the time, not a new one.
   */
  eventType?: string | null;
  createdAt: string;
}

/** An internal note about an order. */
export interface OrderNote {
  id: number;
  orderId: number;
  author: string;
  body: string;
  internal: boolean;
  createdAt: string;
}

/** The shipment of an order. */
export interface OrderShipment {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  /** When the parcel is expected, if the store recorded an ETA. */
  estimatedDeliveryAt: string | null;
}

/** A refund: money that was given back. */
export interface OrderRefund {
  id: number;
  orderId: number;
  amount: number;
  reason: string | null;
  createdBy: string | null;
  /** True while the money has NOT gone back through the gateway. */
  manual: boolean;
  gatewayReference: string | null;
  createdAt: string;
}

/** The payment of an order, in full. */
export interface OrderPaymentDetails {
  method: PaymentMethod | null;
  status: PaymentStatus | null;
  transactionReference: string | null;
  paidAt: string | null;
  amount: number | null;
  /** The total minus the refunds. Null while a refund has no amount yet. */
  netPaid: number | null;
  refunds: OrderRefund[];
}

/** The counts behind the orders list. */
export interface OrderStats {
  total: number;
  byStatus: Array<{ status: OrderStatus; count: number }>;
  byPaymentStatus: Array<{ paymentStatus: PaymentStatus; count: number }>;
  byPaymentMethod: Array<{ paymentMethod: PaymentMethod; count: number }>;
}

/**
 * Where a return stands (FE-20).
 *
 * <p>`REQUESTED` has NOT moved stock; `APPROVED` put the units back through the
 * stock log; `REJECTED` moved nothing and is final.
 */
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED';

/** One returned line: which order line, how many units, and its remark. */
export interface OrderReturnItem {
  id: number;
  orderItemId: number;
  /** The variant the units go back to on approval. */
  variantId: number | null;
  sku: string | null;
  productName: string | null;
  quantity: number;
  note: string | null;
}

/** A return: goods that came back from the customer. */
export interface OrderReturn {
  id: number;
  orderId: number;
  status: ReturnStatus;
  reason: string;
  requestedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  /** The refund that pays this return back, when one is linked. */
  refundId: number | null;
  createdAt: string;
  updatedAt: string;
  items: OrderReturnItem[];
}

/** What the create-return dialog sends. */
export interface CreateReturnPayload {
  reason: string;
  refundId?: number | null;
  items: Array<{ orderItemId: number; quantity: number; note?: string | null }>;
}

/** Where a queued e-mail ended up. */
export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DEAD';

/**
 * The answer to "resend the confirmation".
 *
 * `emailStatus` is what the mail provider (or the retry worker) said, so the
 * page can turn a refusal into a warning instead of a success.
 */
export interface OrderConfirmationResend {
  orderId: number;
  recipientEmail: string;
  emailStatus: EmailStatus;
}
