import { NotificationItem } from './models/notification.model';

export interface NotificationTypeConfig {
  icon: string; // lucide icon name without prefix handling done by caller (full ng-icon name)
  tint: string; // tailwind classes: soft bg + icon color
  i18nKey: string; // key under notifications.types
  route: (n: NotificationItem) => string | null;
}

const tint = {
  copper: 'bg-primary/10 text-primary',
  red: 'bg-destructive-soft text-destructive-text',
  amber: 'bg-warning-soft text-warning',
  blue: 'bg-info-soft text-info',
  green: 'bg-success-soft text-success',
  neutral: 'bg-muted text-muted-foreground',
};

export const NOTIFICATION_TYPE_REGISTRY: Record<string, NotificationTypeConfig> = {
  'order.new': {
    icon: 'lucideShoppingBag',
    tint: tint.copper,
    i18nKey: 'order_new',
    route: (n) => n.link || (n.entityId ? `/dashboard/orders/${n.entityId}` : '/dashboard/orders'),
  },
  'ORDER_CREATED': {
    icon: 'lucideShoppingBag',
    tint: tint.copper,
    i18nKey: 'order_new',
    route: (n) => n.link || (n.entityId ? `/dashboard/orders/${n.entityId}` : '/dashboard/orders'),
  },
  'payment.failed': {
    icon: 'lucideCreditCard',
    tint: tint.red,
    i18nKey: 'payment_failed',
    route: (n) => n.link || (n.entityId ? `/dashboard/orders/${n.entityId}` : '/dashboard/orders'),
  },
  'PAYMENT_FAILED': {
    icon: 'lucideCreditCard',
    tint: tint.red,
    i18nKey: 'payment_failed',
    route: (n) => n.link || (n.entityId ? `/dashboard/orders/${n.entityId}` : '/dashboard/orders'),
  },
  'PAYMENT_SUCCEEDED': {
    icon: 'lucideCreditCard',
    tint: tint.green,
    i18nKey: 'payment_succeeded',
    route: (n) => n.link || (n.entityId ? `/dashboard/orders/${n.entityId}` : '/dashboard/orders'),
  },
  'review.pending': {
    icon: 'lucideStar',
    tint: tint.amber,
    i18nKey: 'review_pending',
    route: () => '/dashboard/reviews?status=pending',
  },
  'REVIEW_CREATED': {
    icon: 'lucideStar',
    tint: tint.amber,
    i18nKey: 'review_pending',
    route: (n) => n.link || '/dashboard/reviews?status=pending',
  },
  'contact.message': {
    icon: 'lucideMail',
    tint: tint.blue,
    i18nKey: 'contact_message',
    route: () => '/dashboard/contact-messages',
  },
  'stock.low': {
    icon: 'lucideAlertTriangle',
    tint: tint.red,
    i18nKey: 'stock_low',
    route: (n) => (n.entityId ? `/dashboard/products/${n.entityId}/edit?tab=variants` : '/dashboard/products'),
  },
  'user.new': {
    icon: 'lucideUserPlus',
    tint: tint.green,
    i18nKey: 'user_new',
    route: (n) => (n.entityId ? `/dashboard/users/${n.entityId}` : '/dashboard/users'),
  },
  'system': {
    icon: 'lucideBell',
    tint: tint.neutral,
    i18nKey: 'system',
    route: () => null,
  },
};

export function notificationTypeConfig(type: string): NotificationTypeConfig | null {
  return NOTIFICATION_TYPE_REGISTRY[type] ?? null;
}

export function notificationIcon(type: string): string {
  return NOTIFICATION_TYPE_REGISTRY[type]?.icon ?? 'lucideBell';
}

export function notificationTint(type: string): string {
  return NOTIFICATION_TYPE_REGISTRY[type]?.tint ?? 'bg-muted text-muted-foreground';
}

export function notificationRoute(n: NotificationItem): string | null {
  const cfg = NOTIFICATION_TYPE_REGISTRY[n.type];
  if (cfg) return cfg.route(n);
  return n.link || null;
}
