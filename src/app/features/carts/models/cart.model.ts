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
  subtotal: number;
}

export interface CartResponse {
  id: number;
  userId: number;
  userEmail: string;
  userFullName: string;
  /** Optional avatar URL for the cart owner (backend may or may not send it). */
  userAvatarUrl?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  items: CartItemResponse[];
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  // --- proposed by Phase 1 / API_GAPS.md (backend may not send these yet) ---
  status?: 'ACTIVE' | 'ABANDONED' | 'CONVERTED';
  lastActivityAt?: string;
  convertedOrderId?: number | null;
}