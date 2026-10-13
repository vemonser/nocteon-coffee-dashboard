export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'ONLINE' | 'CASH_ON_DELIVERY';

export interface OrderItemResponse {
  id: number;
  variantId: number;
  sku: string;
  productSlug: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderResponse {
  id: number;
  status: OrderStatus;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  shippingCost: number;
  discountAmount: number;
  notes: string | null;
  items: OrderItemResponse[];
  createdAt: string;
}

export interface OrderFilterRequest {
  page?: number;
  size?: number;
  sort?: string;
  direction?: string;
  status?: OrderStatus;
  userId?: number;
}
