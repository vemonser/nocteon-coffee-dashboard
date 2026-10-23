/**
 * The Needs-attention queue, as data.
 *
 * The panel used to push a row for "Pending orders" AND a row for "Open
 * orders" — and open orders already CONTAIN pending, confirmed, processing
 * and shipped. The same order was therefore counted twice, and the two rows
 * linked to different filters. This module is the one rule: open orders are
 * one queue, with the pending/processing/shipped split carried as a detail
 * line so the useful information is not lost.
 *
 * The input is deliberately plain numbers: the component owns the fetches
 * (the overview, carts, messages, reviews), and this function owns only the
 * ordering, the de-duplication and the links. That makes the rule testable
 * without an Angular TestBed.
 */

export interface AttentionCounts {
  /** Paid orders whose order status is PENDING. */
  pendingOrders: number;
  /** Paid orders whose order status is CONFIRMED. */
  confirmedOrders: number;
  /** Paid orders whose order status is PROCESSING. */
  processingOrders: number;
  /** Paid orders whose order status is SHIPPED. */
  shippedOrders: number;
  /** Contact messages that have not been read. */
  unreadMessages: number;
  /** Reviews waiting for moderation. */
  pendingReviews: number;
  /** Products at or below their reorder threshold. */
  lowStock: number;
  /** Carts abandoned by the customer. */
  abandonedCarts: number;
}

export interface AttentionItem {
  /** The i18n key of the row label. */
  key: string;
  /** The i18n key of the one-line explanation. */
  hintKey: string;
  /** The number in the badge. */
  count: number;
  /** An `@ng-icons/lucide` name. Decorative. */
  icon: string;
  /** Where the row leads. */
  link: string;
  /** The query parameters the destination understands. */
  queryParams: Record<string, string>;
  /**
   * The order-status split, for the open-orders row only. It is kept out of
   * the count so the badge and the detail can never disagree.
   */
  breakdown?: {
    pending: number;
    processing: number;
    shipped: number;
  };
}

/** Open = every paid order that has not reached a terminal state. */
export function openOrdersCount(counts: AttentionCounts): number {
  return (
    (counts.pendingOrders || 0) +
    (counts.confirmedOrders || 0) +
    (counts.processingOrders || 0) +
    (counts.shippedOrders || 0)
  );
}

/**
 * The queue, in the order an operator should read it.
 *
 * 1. Open orders — the work that moves money.
 * 2. Unread messages — a customer is waiting for an answer.
 * 3. Reviews — the catalogue's social proof is blocked.
 * 4. Low stock — the next order may not be fillable.
 * 5. Abandoned carts — recoverable revenue, but not urgent.
 *
 * A zero count is omitted: a row with "0" is not an attention item, it is
 * noise. When everything is zero the panel shows its single all-clear line.
 */
export function buildAttentionItems(counts: AttentionCounts): AttentionItem[] {
  const items: AttentionItem[] = [];

  const open = openOrdersCount(counts);
  if (open > 0) {
    items.push({
      key: 'needsAttention.openOrders',
      hintKey: 'needsAttention.openOrdersHint',
      count: open,
      icon: 'lucideShoppingCart',
      // The orders list does not have a multi-status tab, so the row lands
      // on the unfiltered list rather than on one status that would show a
      // smaller number than the badge.
      link: '/dashboard/orders',
      queryParams: {},
      breakdown: {
        pending: counts.pendingOrders || 0,
        processing: counts.processingOrders || 0,
        shipped: counts.shippedOrders || 0,
      },
    });
  }

  if (counts.unreadMessages > 0) {
    items.push({
      key: 'needsAttention.unreadMessages',
      hintKey: 'needsAttention.unreadMessagesHint',
      count: counts.unreadMessages,
      icon: 'lucideMail',
      link: '/dashboard/contact-messages',
      queryParams: { status: 'unread' },
    });
  }

  if (counts.pendingReviews > 0) {
    items.push({
      key: 'needsAttention.pendingReviews',
      hintKey: 'needsAttention.pendingReviewsHint',
      count: counts.pendingReviews,
      icon: 'lucideStar',
      link: '/dashboard/reviews',
      queryParams: { status: 'pending' },
    });
  }

  if (counts.lowStock > 0) {
    items.push({
      key: 'needsAttention.lowStock',
      hintKey: 'needsAttention.lowStockHint',
      count: counts.lowStock,
      icon: 'lucidePackage',
      link: '/dashboard/products',
      queryParams: { status: 'active', stock: 'low' },
    });
  }

  if (counts.abandonedCarts > 0) {
    items.push({
      key: 'needsAttention.abandonedCarts',
      hintKey: 'needsAttention.abandonedCartsHint',
      count: counts.abandonedCarts,
      icon: 'lucideShoppingCart',
      link: '/dashboard/carts',
      queryParams: { view: 'abandoned' },
    });
  }

  return items;
}
