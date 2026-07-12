// Pairing = food pairing suggestion: Dark Chocolate, Cardamom, Honey…
export interface PairingTranslation {
  language: string;
  name: string;
  description?: string;
}
export interface PairingResponse {
  id: string;
  slug: string;
  imageUrl: string | null;
  translations: PairingTranslation[];
}
export interface PairingRequest {
  translations: PairingTranslation[];
}
