import { BaseListParams } from "../../../core/crud/base-crud.service";


export interface ProcessingMethodListParams extends BaseListParams {
  // لا يوجد فلاتر إضافية
}

export interface ProcessingMethodResponse {
  id: number;
  slug: string;
  translations: ProcessingMethodTranslation[];
}

export interface ProcessingMethodTranslation {
  language: string;
  name: string;
  description?: string;
}

export interface ProcessingMethodRequest {
  translations: ProcessingMethodTranslation[];
}