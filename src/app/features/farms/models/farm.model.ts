export interface FarmTranslation {
  language: string;
  name: string;
  country?: string;
  description?: string;
}

export interface FarmResponse {
  id: number;
  slug: string;
  originSlug: string;
  createdAt?: string;
  imageUrl: string | null;
  translations: FarmTranslation[];
}

export interface DashboardFarmResponse {
  id: number;
  slug: string;
  originSlug: string;
  imageUrl: string | null;
  translations: FarmTranslation[];
}

export interface FarmRequest {
  originSlug: string;
  translations: FarmTranslation[];
}

// نفس ProductCardResponse بتاع الكاتيجوري بالحرف — بيتشارك بين كل الـ lookups
export interface ProductCardResponse {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  productType: string;
  shortDescription: string;
  featured: boolean;
  primaryImageUrl: string | null;
  maxPrice: string;
  minPrice: string;
  discountPercentage: string;
  isActive: boolean;
}