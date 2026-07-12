export interface FarmResponse {
    id: number;
    slug: string;
    originSlug: string;
    createdAt?: string;
    imageUrl: string | null;
    translations: FarmTranslation[];
}

export interface FarmTranslation {
    language: string;
    name: string;
    country?: string;
    description?: string;
}

export interface FarmRequest {
    originSlug: string;
    translations: FarmTranslation[];
}