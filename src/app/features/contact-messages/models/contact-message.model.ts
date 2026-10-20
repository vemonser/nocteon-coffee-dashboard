export interface ContactResponse {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  isReplied: boolean;
  replyContent: string | null;
  createdAt: string;
}