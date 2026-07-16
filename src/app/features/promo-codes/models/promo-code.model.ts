export type PromoCodeDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
export type PromoScopeType = 'GLOBAL' | 'CATEGORY';

export interface PromoCodeCategoryRef {
  id: string;
  name: string; // ASSUMPTION: adjust to whatever your mapper returns (could be slug/name)
  slug: string; // ASSUMPTION: adjust to whatever your mapper returns (could be slug/name)
}

export interface PromoCodeResponse {
  id: string;
  code: string;
  discountType: PromoCodeDiscountType;
  discountValue: number | null;
  minOrderAmount: number | null;
  scopeType: PromoScopeType;
  categorySlugs: string[];
  maxTotalRedemptions: number | null;
  maxRedemptionsPerUser: number;
  validFrom: string; // ISO instant string
  validUntil: string;
  active: boolean; // ASSUMPTION: verify your DTO field name — Jackson may serialize the entity's `active` boolean as "active", not "isActive". Check your mapper output once and adjust here if needed.
  createdAt: string;
}

export interface PromoCodeRequest {
  code: string;
  discountType: PromoCodeDiscountType;
  discountValue: number | null;
  minOrderAmount: number | null;
  scopeType: PromoScopeType;
  categorySlugs: string[]; // send [] when scopeType is GLOBAL
  maxTotalRedemptions: number | null;
  maxRedemptionsPerUser: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}