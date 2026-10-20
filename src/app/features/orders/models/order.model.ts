/**
 * The order domain model — the ONE place the API's order shape is described.
 *
 * Every field here is a field the backend actually returns. The backend owns
 * the data, so the model never invents one: a capability the API does not
 * expose (tax, refund amounts, a carrier, a status history) is NOT modelled
 * as a field, because a field that is always `undefined` is a lie. Those
 * gaps are listed in `ORDERS_CONTRACT.md`.
 */

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type PaymentMethod = 'ONLINE' | 'CASH_ON_DELIVERY';

export interface OrderItemResponse {
  id: number;
  variantId: number;
  sku: string;
  productSlug: string;
  productName: string | null;
  primaryImageUrl: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderAddressResponse {
  id: number;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
}

export interface OrderCustomerResponse {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
}

export interface OrderResponse {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  shippingCost: number;
  discountAmount: number;
  notes: string | null;
  /**
   * Why the order was cancelled, when it was.
   *
   * <p>Null for every order that was not cancelled.
   */
  cancellationReason?: string | null;
  /** The shipment: the carrier, the tracking number and the times. */
  shipment?: {
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
  items: OrderItemResponse[];
  createdAt: string;
  address?: OrderAddressResponse | null;
  customer?: OrderCustomerResponse | null;
}

/**
 * The filters the list sends to the backend.
 *
 * The backend's `OrderFilterRequest` (page, size, sort, direction, status,
 * userId) is a SUBSET of this: `paymentStatus`, `paymentMethod`, the date
 * range and the search term are NOT accepted by the API today. They are kept
 * here because the UI must still be able to express them (and the contract
 * for them is written down in ORDERS_CONTRACT.md) — the service sends only
 * what the API accepts and the list reports the rest as unsupported.
 */
export interface OrderFilterRequest {
  page?: number;
  size?: number;
  sort?: string;
  direction?: string;
  status?: OrderStatus;
  userId?: number;
  search?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
}

/** The filters the LIST page keeps in the URL. */
export interface OrdersUrlState {
  status: OrderStatus | 'ALL';
  paymentStatus: PaymentStatus | 'ALL';
  paymentMethod: PaymentMethod | 'ALL';
  range: 'today' | '7d' | '30d' | 'custom';
  dateFrom: string | null;
  dateTo: string | null;
  search: string;
  sort: string;
  direction: 'asc' | 'desc';
  page: number;
  size: number;
}
