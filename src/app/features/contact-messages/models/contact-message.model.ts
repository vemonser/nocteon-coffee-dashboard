export interface ContactResponse {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  isReplied: boolean;
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
