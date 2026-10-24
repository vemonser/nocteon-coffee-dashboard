export interface NotificationItem {
  id: number | string;
  type: string;
  title?: string;
  message?: string;
  titleKey?: string;
  bodyKey?: string;
  params?: Record<string, unknown>;
  entityType?: string;
  entityId?: string | number;
  link?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
  customerName?: string | null;
}

export type NotificationFilter = 'all' | 'unread';

// Back-compat aliases for older call sites
export type NotificationDto = NotificationItem;
export type NotificationResponse = NotificationItem;
export type NotificationType = string;
