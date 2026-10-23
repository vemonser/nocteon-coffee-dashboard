import type { OrderResponse, OrderStatus, PaymentMethod, PaymentStatus } from '../models/order.model';

/**
 * The filters the ORDERS LIST applies.
 *
 * The API accepts `status` only (see `OrderService.UNSUPPORTED_FILTERS`).
 * The rest are applied here, over the whole set the service fetched, so the
 * numbers on screen are EXACT rather than "the rows on this page".
 */
export interface OrderFilters {
  paymentStatus: PaymentStatus | 'ALL';
  paymentMethod: PaymentMethod | 'ALL';
  /** `today` | `7d` | `30d` | `all` | `custom`. */
  range: 'today' | '7d' | '30d' | 'all' | 'custom';
  /** Inclusive ISO date (YYYY-MM-DD) for the custom range. */
  from: string | null;
  to: string | null;
  search: string;
}

export const DEFAULT_ORDER_FILTERS: OrderFilters = {
  paymentStatus: 'ALL',
  paymentMethod: 'ALL',
  range: 'all',
  from: null,
  to: null,
  search: '',
};

/** The start of a local calendar day. */
function startOfDay(d: Date): Date {
  const copy = new Date(d.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The window a range covers, as INCLUSIVE ISO dates.
 *
 * The days are CALENDAR days in the browser's time zone, which is the
 * store's time zone (Africa/Cairo) on the machines the dashboard runs on —
 * the same rule the dashboard's own day series uses. An order placed at
 * 23:30 therefore belongs to THAT day and not to the next one.
 */
export function rangeWindow(
  range: OrderFilters['range'],
  from: string | null,
  to: string | null,
  now: Date = new Date(),
): { start: string; end: string } | null {
  if (range === 'all') return null;

  if (range === 'today') {
    const day = toIsoDate(now);
    return { start: day, end: day };
  }

  if (range === '7d' || range === '30d') {
    const days = range === '7d' ? 7 : 30;
    const end = addDays(startOfDay(now), 1); // exclusive: midnight after today
    const start = addDays(end, -days);
    return { start: toIsoDate(start), end: toIsoDate(addDays(end, -1)) };
  }

  // custom
  if (!from && !to) return null;
  return {
    start: from ?? '0000-01-01',
    end: to ?? '9999-12-31',
  };
}

/** Is the order inside the range? */
export function matchesRange(
  createdAt: string | null | undefined,
  window: { start: string; end: string } | null,
): boolean {
  if (!window) return true;
  if (!createdAt) return false;
  const day = toIsoDate(new Date(createdAt));
  return day >= window.start && day <= window.end;
}

/**
 * Does the order match the search term?
 *
 * The term is matched against the order number, the customer's name, the
 * customer's e-mail and the shipping phone — the four things a support
 * agent has in front of them.
 */
export function matchesSearch(order: OrderResponse, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    order.orderNumber ?? '',
    order.customer?.name ?? '',
    order.customer?.email ?? '',
    order.address?.phone ?? '',
    order.address?.fullName ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

/** The filters that do NOT include the status tab. */
export function applyFilters(orders: OrderResponse[], filters: OrderFilters, now: Date = new Date()): OrderResponse[] {
  const window = rangeWindow(filters.range, filters.from, filters.to, now);
  return orders.filter((order) => {
    if (filters.paymentStatus !== 'ALL' && order.paymentStatus !== filters.paymentStatus) return false;
    if (filters.paymentMethod !== 'ALL' && order.paymentMethod !== filters.paymentMethod) return false;
    if (!matchesRange(order.createdAt, window)) return false;
    if (!matchesSearch(order, filters.search)) return false;
    return true;
  });
}

/** The counts per status, for the status tabs. */
export function countByStatus(orders: OrderResponse[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const order of orders) {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
  }
  return counts;
}

/** The counts per payment status, for the payment-status filter. */
export function countByPaymentStatus(orders: OrderResponse[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const order of orders) {
    counts[order.paymentStatus] = (counts[order.paymentStatus] ?? 0) + 1;
  }
  return counts;
}

/** The counts per payment method, for the payment-method filter. */
export function countByPaymentMethod(orders: OrderResponse[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const order of orders) {
    counts[order.paymentMethod] = (counts[order.paymentMethod] ?? 0) + 1;
  }
  return counts;
}

/** The statuses that count as "still open" (not shipped, not finished). */
export const OPEN_STATUSES: readonly OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'];
