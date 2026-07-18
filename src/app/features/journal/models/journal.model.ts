export interface JournalPostTranslationRequest {
  language: 'en' | 'ar';
  title: string;
  excerpt?: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface JournalPostRequest {
  categorySlug: string;
  featured: boolean;
  publishedAt: string | null;
  productSlugs: string[];
  translations: JournalPostTranslationRequest[];
}

export interface JournalPostResponse {
  id: string;
  slug: string;
  categorySlug: string;
  coverImageUrl: string | null;
  featured: boolean;
  publishedAt: string | null;
  title: string | null;
  excerpt: string | null;
  content?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  relatedProductSlugs?: string[];
}

export interface JournalFilterParams {
  page?: number;
  sort?: string;
  direction?: string;
  search?: string;
  categorySlug?: string;
  featured?: boolean;
}