import { ProductCardResponse } from '../../categories/models/category.model';

export interface BrewingMethodTranslation {
  language: string;
  name: string;
  description?: string;
}

export interface BrewingMethodResponse {
  id: number;
  slug: string;
  createdAt?: string;
  translations: BrewingMethodTranslation[];
  
}

export interface BrewingMethodRequest {
  translations: BrewingMethodTranslation[];
}

export interface DashboardBrewingMethodResponse {
  id: number;
  slug: string;
  createdAt?: string;
  deletedAt?: string;
  translations: BrewingMethodTranslation[];
}

export interface ProductWithScoreResponse {
  product: ProductCardResponse; 
  score: number;
}
