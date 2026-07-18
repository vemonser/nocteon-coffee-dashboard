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
  weightGrams: number;
  grindType: string;
  quantity: number;
  stockQuantity: number;
  subtotal: number;
}

export interface CartResponse {
  id: number;
  userId: number;
  userEmail: string;
  userFullName: string;
  items: CartItemResponse[];
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}
