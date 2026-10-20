export interface StoreSetting {
  freeShippingThreshold: number;
  currency: string;
  isFreeShippingActive: boolean;
}
export interface StoreSettingResponse {
  id?: string;
  freeShippingThreshold: number;
  currency: string;
  isFreeShippingActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
