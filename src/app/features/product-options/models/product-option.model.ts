export interface ProductOptionTranslation {
  language: string;
  name: string;
}

export interface ProductOptionValueTranslation {
  language: string;
  name: string;
}

export interface ProductOptionValue {
  id: number;
  slug: string;
  sortOrder?: number;
  numericValue?: number | null;
  translations: ProductOptionValueTranslation[];
}

export interface ProductOption {
  id: number;
  slug: string;
  sortOrder?: number;
  createdAt?: string;
  translations: ProductOptionTranslation[];
  values: ProductOptionValue[];
}

export interface ProductOptionRequest {
  translations: ProductOptionTranslation[];
  sortOrder?: number;
}

export interface ProductOptionValueRequest {
  translations: ProductOptionValueTranslation[];
  sortOrder?: number;
  numericValue?: number | null;
}

/** Summary shape used inside cart items / product variants. */
export interface ProductOptionValueSummary {
  optionSlug: string;
  optionName: string;
  valueSlug: string;
  value: string;
}