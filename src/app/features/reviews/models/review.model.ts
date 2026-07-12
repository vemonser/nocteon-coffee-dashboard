export interface ReviewResponse {
  id: number;
  username: string;
  avatarUrl: string | null;
  rating: number;
  comment: string;
  verified: boolean;
  approved: boolean;
  productSlug: string;
  createdAt: string;
}
export interface ReviewRequest {
  approved: boolean;
}
