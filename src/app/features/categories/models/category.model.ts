// src/app/core/models/category.model.ts
export interface CategoryResponse {
  id: number;
  createdAt?:string;
  slug: string;
  translations: CategoryTranslationRequest[];
  // name: string;
  // description: string;
  imageUrl: string | null;
  isActive: boolean;
}

export interface CategoryTranslationRequest {
  language: string;
  name: string;
  description?: string;
}

export interface CategoryRequest {
  isActive?: boolean;
  translations: CategoryTranslationRequest[];
}

export interface ProductCardResponse {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  productType: string;
  shortDescription: string;
  featured :  boolean;
  primaryImageUrl: string | null;
  maxPrice: string;
  minPrice: string;
  discountPercentage: string;
  isActive: boolean;
}

export interface DashboardCategoryResponse {
  id: number;
  slug: string;
  imageUrl: string | null;
  isActive: boolean;
  translations: CategoryTranslationRequest[];
}
