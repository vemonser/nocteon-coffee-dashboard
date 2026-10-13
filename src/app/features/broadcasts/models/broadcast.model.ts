export type BroadcastStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface BroadcastResponse {
  id: string;
  subject: string;
  content: string;
  status: BroadcastStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface BroadcastRequest {
  subject: string;
  content: string;
}