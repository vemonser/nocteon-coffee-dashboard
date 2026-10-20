/**
 * THE order number formatter.
 *
 * The order number is generated and owned by the backend
 * (`OrderService.generateOrderNumber` -> `ORD-YYYY-NNNNNN`, e.g.
 * `ORD-2026-000001`). The UI never re-formats it and never invents one: a
 * number it made up would not match the order in the warehouse, the invoice
 * or the e-mail.
 *
 * What this helper does:
 *   - shows the backend's number as it is, in ONE place, for the list, the
 *     detail page, the tooltip and the CSV export;
 *   - falls back to the numeric id when a legacy order has no number, so a
 *     row is never blank;
 *   - keeps the number in a Latin isolate so an RTL paragraph cannot reorder
 *     its digits.
 */

/** The order number as it is shown to a human. */
export function formatOrderNumber(
  orderNumber: string | null | undefined,
  orderId?: number | null,
): string {
  const value = (orderNumber ?? '').trim();
  if (value) return value;
  if (orderId !== null && orderId !== undefined) return `#${orderId}`;
  return '—';
}

/**
 * The order number wrapped in a LEFT-TO-RIGHT ISOLATE (U+2066 … U+2069).
 *
 * `ORD-2026-000001` is a Latin token inside a right-to-left paragraph: the
 * bidi algorithm would otherwise treat the hyphens as neutrals and can
 * reorder the segments. The isolate is inert in a left-to-right paragraph.
 */
export function isolatedOrderNumber(
  orderNumber: string | null | undefined,
  orderId?: number | null,
): string {
  return `\u2066${formatOrderNumber(orderNumber, orderId)}\u2069`;
}
