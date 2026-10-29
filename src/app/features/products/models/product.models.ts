// ════════════════════════════════════════════════════════════════════════════
// LIST DTO — lightweight, used only on the products list page.
// Matches a slim backend projection (NOT the full Product with variants/media/
// tastingNotes/pairings). Keep this in sync with whatever DTO your
// `findAllDashboard` query maps to.
// ════════════════════════════════════════════════════════════════════════════
import { ProductOptionValueSummary } from '../../product-options/models/product-option.model';
import { ProductTagSummary } from '../../product-tags/models/product-tag.model';

export type { ProductTagSummary };

/** FE-11: a "You may also like" entry as the wizard renders it. */
export interface RelatedProductSummary {
  slug: string;
  name: string;
  primaryImageUrl?: string | null;
}

export interface ProductListItem {
  id: number;
  slug: string;
  categorySlug: string;
  categoryName?: string;  // Added for display purposes
  productType: ProductType;
  featured: boolean;
  /** The API serializes Lombok's primitive `isActive` as `active`. */
  active?: boolean;
  isActive: boolean;
  name: string;
  shortDescription?: string | null;
  primaryImageUrl: string | null;
  minPrice: number;
  maxPrice: number;
  discountPercentage?: number | null;
  /** Not currently returned by ProductCardResponse — see DECISIONS.md. */
  variantsCount?: number | null;
  /** Not currently returned by ProductCardResponse — see DECISIONS.md. */
  totalStock?: number | null;
  /** Not currently returned by ProductCardResponse — see DECISIONS.md. */
  lowStockVariantCount?: number | null;
  /**
   * FE-14: the average of the product's counted (approved, not deleted)
   * reviews, already rounded to one decimal by the API. `null` when nothing is
   * counted — never 0.0, which would claim "everyone gave it zero stars".
   *
   * Optional on purpose: an older backend does not send the field at all, and
   * the list then hides the whole rating column instead of printing blanks.
   */
  averageRating?: number | null;
  /** FE-14: how many counted reviews the average is built from (0 when none). */
  reviewCount?: number | null;
  stockStatus?: 'in-stock' | 'low' | 'out' | 'unknown';
  updatedAt?: string;
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
  /** FE-10: only products carrying this tag. */
  tagSlug?: string;
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
  /** The editorial story, per language. */
  story?: string;
  /** Search/social title for this language; the API falls back to the name. */
  metaTitle?: string;
  /** Search/social description for this language; falls back to the short description. */
  metaDescription?: string;
}

/** Backend ProductVariantResponse — includes resolved option summaries. */
export interface ProductVariant {
  id?: number;
  sku: string;
  /** FE-15: the scannable code printed on the packaging. Absent when the variant has none. */
  barcode?: string | null;
  price: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  /** The variant's own photo; empty means "use the product gallery". */
  imageUrl?: string | null;
  stockQuantity: number;
  reservedQuantity?: number;
  reorderThreshold?: number;
  discountPercentage?: number;
  /** The API serializes the primitive `isActive` as `active`. */
  active?: boolean;
  isActive: boolean;
  optionValues: ProductOptionValueSummary[];
}

/** Backend ProductVariantRequest — references option value IDs. */
export interface ProductVariantRequest {
  sku: string;
  /** FE-15: omitted (or blank) means "no barcode" — the API stores null, not an empty string. */
  barcode?: string;
  price: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  /** Omitted means "use the product gallery" — the API stores null, not an empty string. */
  imageUrl?: string;
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
  /** The API serializes the primitive `isActive` as `active`. */
  active?: boolean;
  isActive: boolean;
  featured: boolean;
  translations: ProductTranslation[];
  coffeeDetails?: CoffeeDetails;
  variants: ProductVariant[];
  media: ExistingMedia[];
  tastingNotes: TastingNote[];
  pairings: ProductPairing[];
  brewingMethods: ProductBrewingMethod[];
  /** Merchandising tags (FE-10): slug + localized name, as the API returns them. */
  tags?: ProductTagSummary[];
  /** "You may also like" (FE-11), in display order. */
  relatedProducts?: RelatedProductSummary[];
  /** The product's own social card; empty means "use the primary image". */
  ogImageUrl?: string | null;
}

// Request payload sent to backend on save.
// Media is handled separately via FormData (see service).
export interface ProductRequest {
  categorySlug: string;
  originSlug?: string;
  farmSlug?: string;
  productType: ProductType;
  /** What the backend's ProductRequest actually binds. */
  active: boolean;
  /** Kept for older callers; the backend ignores it. */
  isActive?: boolean;
  featured: boolean;
  translations: ProductTranslation[];
  coffeeDetails?: CoffeeDetails;
  media: ProductMediaRequest[];
  variants: ProductVariantRequest[];
  tastingNoteSlugs: string[];
  pairingSlugs: string[];
  brewingMethods: ProductBrewingMethod[];
  /** Merchandising tags by slug (FE-10). Omitted means "no tags". */
  tagSlugs?: string[];
  /** "You may also like" by slug (FE-11), max 6, in display order. */
  relatedProductSlugs?: string[];
  /** Omitted means "use the primary image" — the API stores null, not an empty string. */
  ogImageUrl?: string;
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
  /** The media API serializes `isPrimary` as `primary`. */
  primary?: boolean;
  isPrimary: boolean;
}

export interface ProductMediaRequest {
  altText?: string;
  type: 'IMAGE' | 'VIDEO';
  sortOrder: number;
  isPrimary: boolean;
}
