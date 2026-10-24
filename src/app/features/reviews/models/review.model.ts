export interface ReviewResponse {
  id: number;
  username: string;
  avatarUrl: string | null;
  rating: number;
  comment: string;
  verified: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  productName: string | null;
  productSlug: string;
  primaryImageUrl: string | null;
  createdAt: string;
  /** The order behind a confirmed purchase, when there is one. */
  orderId: number | null;
  orderNumber: string | null;
  /** Optional moderation audit fields — present only on backends that track them. */
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  moderationNote?: string | null;
}

export interface ReviewRequest {
  approved: boolean;
}

export interface ReviewRejectRequest {
  rejected: boolean;
}

/** The moderation statistics — the counts the tabs and the strip show. */
export interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  verified: number;
  averageRating: number | null;
  averageRatingAll: number | null;
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
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}
