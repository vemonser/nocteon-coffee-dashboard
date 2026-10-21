// ════════════════════════════════════════════════════════════════════════════
// LIST DTO — lightweight, used only on the products list page.
// Matches a slim backend projection (NOT the full Product with variants/media/
// tastingNotes/pairings). Keep this in sync with whatever DTO your
// `findAllDashboard` query maps to.
// ════════════════════════════════════════════════════════════════════════════
import { ProductOptionValueSummary } from '../../product-options/models/product-option.model';

export interface ProductListItem {
  id: number;
  slug: string;
  categorySlug: string;
  productType: ProductType;
  featured: boolean;
  isActive: boolean;
  name: string;
  shortDescription?: string | null;
  primaryImageUrl: string | null;
  minPrice: number;
  maxPrice: number;
  discountPercentage?: number | null;
}

// export type ProductType = 'WHOLE_BEAN' | 'GROUND' | 'CAPSULE' | 'INSTANT'; // adjust to your enum
export type ProductType = 'COFFEE' | 'EQUIPMENT'; // adjust to your enum

export interface ProductListParams {
  page?: number;
  size?: number;
  search?: string;
  categorySlug?: string;
  originSlug?: string;
  farmSlug?: string;
  productType?: ProductType;
  minRating?: number;
  featured?: boolean;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  brewingMethodSlug?: string;
  optionValueIds?: number[];
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export interface ProductBrewingMethod {
  brewingMethodSlug: string;
  notes?: string; // e.g. "Best at 92°C, 4 min steep"
}

export interface CoffeeDetails {
  processingMethodSlug?: string; // FK → ProcessingMethod
  coffeeVarietySlug?: string; // FK → CoffeeVariety
  altitude?: number; // meters above sea level
  harvestYear?: number; // e.g. "October - December"
  roastLevelSlug?: string; // FK → RoastLevel (different from roastLevelSlug below)
  story?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// FULL DTOs — used only on the wizard (create/edit) page, fetched by slug.
// One request loads everything needed for all wizard steps.
// ════════════════════════════════════════════════════════════════════════════

export interface ProductTranslation {
  language: string;
  name: string;
  description?: string;
  shortDescription?: string;
}

/** Backend ProductVariantResponse — includes resolved option summaries. */
export interface ProductVariant {
  id?: number;
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  stockQuantity: number;
  reservedQuantity?: number;
  reorderThreshold?: number;
  discountPercentage?: number;
  isActive: boolean;
  optionValues: ProductOptionValueSummary[];
}

/** Backend ProductVariantRequest — references option value IDs. */
export interface ProductVariantRequest {
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  stockQuantity: number;
  reorderThreshold?: number;
  isActive: boolean;
  optionValueIds: number[];
}

export interface TastingNoteTranslation {
  language: string;
  name: string;
}

export interface TastingNote {
  id?: number;
  slug?: string; // existing tasting note picked from a select, or new
  translations: TastingNoteTranslation[];
}

export interface ProductPairing {
  pairingSlug: string; // FK to Pairing entity (see pairings module)
}

export interface ProductDetail {
  id: number;
  slug: string;
  categorySlug: string;
  originSlug?: string;
  farmSlug?: string;
  productType: ProductType;
  isActive: boolean;
  featured: boolean;
  translations: ProductTranslation[];
  coffeeDetails?: CoffeeDetails;
  variants: ProductVariant[];
  media: ExistingMedia[];
  tastingNotes: TastingNote[];
  pairings: ProductPairing[];
  brewingMethods: ProductBrewingMethod[];
}

// Request payload sent to backend on save.
// Media is handled separately via FormData (see service).
export interface ProductRequest {
  categorySlug: string;
  originSlug?: string;
  farmSlug?: string;
  productType: ProductType;
  isActive: boolean;
  featured: boolean;
  translations: ProductTranslation[];
  coffeeDetails?: CoffeeDetails;
  media: ProductMediaRequest[];
  variants: ProductVariantRequest[];
  tastingNoteSlugs: string[];
  pairingSlugs: string[];
  brewingMethods: ProductBrewingMethod[];
}

export interface StagedMedia {
  file: File;
  previewUrl: string;
  type: 'IMAGE' | 'VIDEO';
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ExistingMedia {
  id: number;
  url: string;
  altText: string;
  type: 'IMAGE' | 'VIDEO';
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductMediaRequest {
  altText?: string;
  type: 'IMAGE' | 'VIDEO';
  sortOrder: number;
  isPrimary: boolean;
}
