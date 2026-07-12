// ════════════════════════════════════════════════════════════════════════════
// LIST DTO — lightweight, used only on the products list page.
// Matches a slim backend projection (NOT the full Product with variants/media/
// tastingNotes/pairings). Keep this in sync with whatever DTO your
// `findAllDashboard` query maps to.
// ════════════════════════════════════════════════════════════════════════════
export interface ProductListItem {
  id: number;
  slug: string;
  primaryImageUrl: string | null;
  name: string;
  minPrice: number;
  maxPrice: number;
  isActive: boolean;
  featured: boolean;
}

// export type ProductType = 'WHOLE_BEAN' | 'GROUND' | 'CAPSULE' | 'INSTANT'; // adjust to your enum
export type ProductType = 'COFFEE' | 'EQUIPMENT'; // adjust to your enum

export interface ProductListParams {
  page?: number;
  size?: number;
  search?: string;
  categorySlug?: string;
  productType?: ProductType;
  isActive?: boolean;
  featured?: boolean;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export enum GrindType {
  WHOLE_BEAN = 'WHOLE_BEAN',
  ESPRESSO = 'ESPRESSO',
  V60 = 'V60',
  POUR_OVER = 'POUR_OVER',
  CHEMEX = 'CHEMEX',
  FRENCH_PRESS = 'FRENCH_PRESS',
  AEROPRESS = 'AEROPRESS',
  MOKA_POT = 'MOKA_POT',
  COLD_BREW = 'COLD_BREW',
  TURKISH = 'TURKISH',
}
export const GRIND_TYPE_LABELS: Record<GrindType, string> = {
  [GrindType.WHOLE_BEAN]: 'Whole Bean',
  [GrindType.ESPRESSO]: 'Espresso',
  [GrindType.V60]: 'V60',
  [GrindType.POUR_OVER]: 'Pour Over',
  [GrindType.CHEMEX]: 'Chemex',
  [GrindType.FRENCH_PRESS]: 'French Press',
  [GrindType.AEROPRESS]: 'AeroPress',
  [GrindType.MOKA_POT]: 'Moka Pot',
  [GrindType.COLD_BREW]: 'Cold Brew',
  [GrindType.TURKISH]: 'Turkish',
};

// ─── Coffee-specific details ──────────────────────────────────────────────────
// Only relevant when productType === 'COFFEE'. Rendered conditionally
// in BasicInfoStep (or its own step if you want to separate it).

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

export interface ProductVariant {
  id?: number; // absent for new variants not yet saved
  sku: string;
  weightGrams: number;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  isActive: boolean;
  grindType: GrindType;
}

export interface ProductBrewingMethod {
  brewingMethodSlug: string;
  notes?: string; // e.g. "Best at 92°C, 4 min steep"
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
  variants: ProductVariant[];
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
