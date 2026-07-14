export interface OriginTranslation {
  language: string;
  name: string;
  description?: string;
}

export interface OriginResponse {
  id: number;
  slug: string;
  code: string;
  createdAt?: string;
  imageUrl: string | null;
  translations: OriginTranslation[];
}

export interface DashboardOriginResponse {
  id: number;
  slug: string;
  code: string;
  imageUrl: string | null;
  translations: OriginTranslation[];
}

export interface OriginRequest {
  code: string;
  translations: OriginTranslation[];
}

export interface OriginOption {
  slug: string;
  name: string;
}

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