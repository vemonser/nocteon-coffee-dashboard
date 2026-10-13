export interface JournalPostTranslationRequest {
  language: 'en' | 'ar';
  title: string;
  excerpt?: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
}

export type JournalPostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface JournalPostRequest {
  categorySlug: string;
  featured: boolean;
  status: JournalPostStatus;
  publishedAt: string | null;
  productSlugs: string[];
  tags: string[];
  translations: JournalPostTranslationRequest[];
}

export interface JournalPostResponse {
  id: string;
  slug: string;
  categorySlug: string;
  authorUsername: string;
  coverImageUrl: string | null;
  featured: boolean;
  status: JournalPostStatus;
  readingTimeMinutes: number;
  publishedAt: string | null;
  tags: string[];
  title: string | null;
  excerpt: string | null;
  content?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  relatedProductSlugs?: string[];
}

export interface JournalFilterParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: string;
  search?: string;
  categorySlug?: string;
  featured?: boolean;
}