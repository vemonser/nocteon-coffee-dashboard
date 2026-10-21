// Pairing = food pairing suggestion: Dark Chocolate, Cardamom, Honey…
export interface PairingTranslation {
  language: string;
  name: string;
  description?: string;
}
export interface PairingResponse {
  id: number;
  slug: string;
  imageUrl: string | null;
  createdAt?: string;
  deletedAt?: string;
  translations: PairingTranslation[];
}
export interface PairingRequest {
  translations: PairingTranslation[];
}

export interface DashboardPairingResponse {
  id: number;
  slug: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt?: string;
  deletedAt?: string;
  translations: PairingTranslation[];
}
