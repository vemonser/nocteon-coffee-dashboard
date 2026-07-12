
export interface TastingNoteTranslation {
  language: string;
  name: string;
  description?: string;
}
export interface TastingNoteResponse {
  id: string;
  slug: string;
  translations: TastingNoteTranslation[];
}
export interface TastingNoteRequest {
  translations: TastingNoteTranslation[];
}
 