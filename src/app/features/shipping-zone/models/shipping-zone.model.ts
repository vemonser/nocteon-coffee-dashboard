export interface ShippingZoneResponse {
  id: number;
  name: string;
  shippingCost: number;
  cities: string[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShippingZoneRequest {
  name: string;
  shippingCost: number;
  cities: string[];
  active: boolean;
}
