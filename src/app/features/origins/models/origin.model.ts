export interface OriginResponse {
  id: number;
  slug: string;
  code: string;
  createdAt?: string;
  imageUrl: string | null;
  translations: OriginTranslation[];
}

export interface OriginTranslation {
  language: string;
  name: string;
  description?: string;
}

export interface OriginRequest {
  code: string;
  translations: OriginTranslation[];
}

export interface OriginOption {
  slug: string;
  name: string;
}
