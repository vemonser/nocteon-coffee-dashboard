import { BaseListParams } from "../../../core/crud/base-crud.service";


export interface CoffeeVarietyListParams extends BaseListParams {

}

export interface CoffeeVarietyResponse {
  id: number;
  slug: string;
  translations: CoffeeVarietyTranslation[];
}

export interface CoffeeVarietyTranslation {
  language: string;
  name: string;
  description?: string;
}

export interface CoffeeVarietyRequest {
  translations: CoffeeVarietyTranslation[];
}