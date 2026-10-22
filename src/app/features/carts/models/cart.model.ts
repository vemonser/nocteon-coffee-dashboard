import { ProductOptionValueSummary } from '../../product-options/models/product-option.model';

export interface CartItemResponse {
  id: number;
  variantId: number;
  sku: string;
  productSlug: string;
  productName: string;
  primaryImageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  discountPercentage: number;
  optionValues: ProductOptionValueSummary[];
  quantity: number;
  stockQuantity: number;
  availableStock: number;
  subtotal: number;
  productIsActive: boolean;
  variantIsActive: boolean;
  outOfStock: boolean;
  lowStock: boolean;
}

export interface CartResponse {
  id: number;
  userId: number;
  userEmail: string;
  userFullName: string;
  avatarUrl: string | null;
  items: CartItemResponse[];
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  lastRemindedAt: string | null;
  status: 'ACTIVE' | 'ABANDONED' | 'CONVERTED';
  convertedOrderId: number | null;
  estimatedShipping: number;
  qualifiesForFreeShipping: boolean;
  freeShippingThreshold: number;
  currency: string;
  hasItems: boolean;
}

export interface CartStatsResponse {
  activeCarts: number;
  abandonedCarts: number;
  convertedCarts: number;
  totalPotentialRevenue: number;
  averageCartValue: number;
}

export interface CartListParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: string;
  search?: string;
  hasItems?: boolean;
  status?: string;
  from?: string;
  to?: string;
}