/**
 * FE-10: a merchandising tag ("New arrivals", "Gift boxes").
 *
 * The slug is the identity: the product form stores it, the list filter sends it and the public
 * API exposes it. The page only edits translated names, so a rename never breaks a filter.
 */
export interface ProductTagTranslation {
  language: string;
  /** The API serializes the translated name as `title` (the shape journal categories use). */
  title: string;
}

export interface ProductTag {
  id: number;
  slug: string;
  createdAt?: string;
  translations: ProductTagTranslation[];
}

export interface ProductTagRequest {
  translations: { language: string; name: string }[];
}

/** A tag on a product, as the wizard and the list filter see it. */
export interface ProductTagSummary {
  slug: string;
  name: string;
}
