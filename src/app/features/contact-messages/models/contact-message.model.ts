export interface ContactResponse {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  replied: boolean;
  replyContent: string | null;
  /** NONE / PENDING / SENT / FAILED / DEAD — the recorded state of the reply email. */
  emailStatus: 'NONE' | 'PENDING' | 'SENT' | 'FAILED' | 'DEAD';
  status: 'NEW' | 'REPLIED' | 'ARCHIVED';
  createdAt: string;
  /** The admin who replied, when there is a reply. */
  repliedBy: string | null;
  /** When the reply was sent, when there is a reply. */
  repliedAt: string | null;
}

export interface ContactStats {
  total: number;
  newCount: number;
  repliedCount: number;
  archivedCount: number;
  unreadCount: number;
}

export interface ContactListParams {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  status?: 'NEW' | 'REPLIED' | 'ARCHIVED';
}
