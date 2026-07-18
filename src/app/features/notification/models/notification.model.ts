export interface NotificationDto {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}
export interface NotificationReq {
  id: string;
}
export type NotificationType = 'ORDER_CREATED' | 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' | 'REVIEW_CREATED';

export interface NotificationResponse {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}