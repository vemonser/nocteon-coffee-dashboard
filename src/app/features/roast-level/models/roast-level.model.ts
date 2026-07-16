// RoastLevel = roast degree: Light, Medium, Dark, Espresso Roast…

export interface RoastLevelTranslation {
  language: string;
  name: string;
  description?: string;
}

export interface RoastLevelResponse {
  id: number;
  slug: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
  translations: RoastLevelTranslation[];
}

export interface RoastLevelRequest {
  color: string;
  translations: RoastLevelTranslation[];
}
