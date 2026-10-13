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
  active: boolean;
  totalRedemptions: number;
  totalDiscountGiven: number;
  usageRate: number;
  createdAt: string;
}

export interface PromoCodeAnalyticsResponse {
  totalDiscountGivenAllTime: number;
  totalRedemptionsAllTime: number;
  activeCodesCount: number;
  topPerformingCodes: {
    code: string;
    redemptionCount: number;
    totalDiscountGiven: number;
  }[];
  redemptionsByDay: {
    date: string;
    count: number;
    discountAmount: number;
  }[];
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