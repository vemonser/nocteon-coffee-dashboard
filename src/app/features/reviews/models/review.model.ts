export interface ReviewResponse {
  id: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  comment: string;
  verified: boolean;
  approved: boolean;
  productName: string;
  productSlug: string;
  primaryImageUrl: string | null;
  createdAt: string;

}
export interface ReviewRequest {
  approved: boolean;
}
