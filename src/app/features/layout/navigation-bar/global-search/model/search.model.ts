export interface GlobalSearchResponse {
  results: SearchResultDto[];
  totalCount: number;
}

export interface SearchResultDto {
  type: string;          
  id: number;
  title: string;
  subtitle: string;
  identifier: string;       // usually the slug
}