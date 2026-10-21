import { BaseListParams } from "../../../core/crud/base-crud.service";

export interface ProcessingMethodListParams extends BaseListParams {
  // لا يوجد فلاتر إضافية
}

export interface ProcessingMethodTranslation {
  language: string;
  name: string;
  description?: string;
}

export interface ProcessingMethodResponse {
  id: number;
  slug: string;
  createdAt?: string;
  deletedAt?: string;
  translations: ProcessingMethodTranslation[];
}

export interface DashboardProcessingMethodResponse {
  id: number;
  slug: string;
  createdAt?: string;
  translations: ProcessingMethodTranslation[];
}

export interface ProcessingMethodRequest {
  translations: ProcessingMethodTranslation[];
}