
export interface TastingNoteTranslation {
  language: string;
  name: string;
  description?: string;
}

export interface TastingNoteResponse {
  id: string;
  slug: string;
  createdAt?: string;
  translations: TastingNoteTranslation[];
}

export interface DashboardTastingNoteResponse {
  id: string;
  slug: string;
  createdAt?: string;
  translations: TastingNoteTranslation[];
}

export interface TastingNoteRequest {
  translations: TastingNoteTranslation[];
}
 