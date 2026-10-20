export interface ContactResponse {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  /**
   * The API names these `read` and `replied`: a boolean getter `isRead()`
   * serialises as "read", and the dashboard was asking for a property the
   * API never sends — which is why every row looked unread.
   */
  read: boolean;
  replied: boolean;
  replyContent: string | null;
  /** NONE / PENDING / SENT / FAILED / DEAD — the recorded state of the reply email. */
  emailStatus: 'NONE' | 'PENDING' | 'SENT' | 'FAILED' | 'DEAD';
  createdAt: string;
}

export interface ContactListParams {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}
