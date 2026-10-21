export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
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
  items: OrderItemResponse[];
  createdAt: string;
  address?: OrderAddressResponse | null;
  customer?: {
    id: number;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
}

export interface OrderFilterRequest {
  page?: number;
  size?: number;
  sort?: string;
  direction?: string;
  status?: OrderStatus;
  userId?: number;
  search?: string;
}
