import { BaseListParams } from "../../../core/crud/base-crud.service";

export interface CoffeeVarietyListParams extends BaseListParams {

}

export interface CoffeeVarietyTranslation {
  language: string;
  name: string;
  description?: string;
}

export interface CoffeeVarietyResponse {
  id: number;
  slug: string;
  createdAt?: string;
  translations: CoffeeVarietyTranslation[];
}

export interface DashboardCoffeeVarietyResponse {
  id: number;
  slug: string;
  createdAt?: string;
  translations: CoffeeVarietyTranslation[];
}

export interface CoffeeVarietyRequest {
  translations: CoffeeVarietyTranslation[];
}