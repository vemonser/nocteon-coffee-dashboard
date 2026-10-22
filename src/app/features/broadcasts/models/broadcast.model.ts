export type BroadcastStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export type BroadcastRecipientStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface BroadcastRecipientResponse {
  id: string;
  email: string;
  status: BroadcastRecipientStatus;
  attemptCount: number;
  lastError: string | null;
  sentAt: string | null;
}

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