export interface GlobalSearchResponse {
  results: SearchResultDto[];
  totalCount: number;
}

export interface SearchResultDto {
  type: string;           // 'CATEGORY' | 'FARM' | 'ORIGIN' | 'PRODUCT' | 'USER' | ...
  id: number;
  title: string;
  subtitle: string;
  identifier: string;       // usually the slug
}