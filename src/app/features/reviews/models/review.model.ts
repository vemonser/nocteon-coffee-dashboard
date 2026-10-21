export interface ReviewResponse {
  id: number;
  username: string;
  avatarUrl: string | null;
  rating: number;
  comment: string;
  verified: boolean;
  approved: boolean;
  productName: string | null;
  productSlug: string;
  primaryImageUrl: string | null;
  createdAt: string;
  /** The order behind a confirmed purchase, when there is one. */
  orderId: number | null;
  orderNumber: string | null;
}

export interface ReviewRequest {
  approved: boolean;
}

/** The moderation statistics — the counts the tabs and the strip show. */
export interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  averageRating: number | null;
  /** Keys "1" … "5". Every key is present, even when it is zero. */
  distribution: Record<string, number>;
}

export interface ReviewListParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  productSlug?: string;
  search?: string;
  isApproved?: boolean;
  isVerified?: boolean;
  minRating?: number;
  createdFrom?: string;
  createdTo?: string;
}
