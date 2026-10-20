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
