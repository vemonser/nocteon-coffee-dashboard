// RoastLevel = roast degree: Light, Medium, Dark, Espresso Roast…

export interface RoastLevelTranslation {
  language: string;
  name: string;
  description?: string;
}
export interface RoastLevelResponse {
  id: string;
  slug: string;
  color:string;
  translations: RoastLevelTranslation[];
}
export interface RoastLevelRequest {
  color:string;
  translations: RoastLevelTranslation[];
}
 