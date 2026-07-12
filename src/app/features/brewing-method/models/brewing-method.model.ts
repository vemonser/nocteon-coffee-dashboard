// BrewingMethod = Pour Over, French Press, AeroPress, Espresso…

import { BaseListParams } from "../../../core/crud/base-crud.service";


export interface BrewingMethodListParams extends BaseListParams {
  // مفيش فلترز إضافية دلوقتي
}
export interface BrewingMethodTranslation {
  language: string;
  name: string;
  description?: string;
}
export interface BrewingMethodResponse {
  id: number;
  slug: string;
  translations: BrewingMethodTranslation[];
}
export interface BrewingMethodRequest {
  translations: BrewingMethodTranslation[];
}
 