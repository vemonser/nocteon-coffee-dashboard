export interface TastingNoteTranslation {
  language: string;
  name: string;
}

export interface TastingNoteResponse {
  id: number;
  slug: string;
  createdAt?: string;
  deletedAt?: string;
  translations: TastingNoteTranslation[];
}

export interface DashboardTastingNoteResponse {
  id: number;
  slug: string;
  createdAt?: string;
  translations: TastingNoteTranslation[];
}

export interface TastingNoteRequest {
  translations: TastingNoteTranslation[];
}