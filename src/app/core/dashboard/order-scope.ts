/**
 * THE definition of what an order COUNT means.
 *
 * The dashboard said "10 orders" and the Orders page said "17 orders", and
 * both numbers were right — they counted different things:
 *
 *   - the dashboard counts the orders the backend's overview endpoint
 *     counts: the orders whose payment status is PAID. Cancelled, pending
 *     and refunded orders are NOT in it.
 *   - the Orders list counts every order the store has, including the
 *     cancelled, the pending and the refunded ones.
 *
 * A reader cannot reconcile the two numbers unless the page says which set
 * it is counting. So the rule lives HERE, once, and both surfaces read it:
 *
 *   - the label ("Paid orders" / "All orders"),
 *   - the explanation ("Excludes cancelled, pending and refunded orders"),
 *   - and the same words in the same order in both languages.
 *
 * The refund rate uses the SAME denominator (`paid`): "2 of 10 orders" is
 * 2 refunded orders out of the 10 PAID orders, so its help text points at
 * this definition instead of repeating it.
 *
 * WHY A REFUNDED ORDER CAN ALSO BE CANCELLED
 * -------------------------------------------
 * "Refunded" is a PAYMENT status (`paymentStatus = REFUNDED`), not an order
 * status. The order status and the payment status are two independent
 * fields, so `status = CANCELLED, paymentStatus = REFUNDED` is a legal
 * combination — and it exists in the seed data (order 12). That is why the
 * refunded orders (2 of them) are NOT a subset of the paid orders (10):
 * the numerator and the denominator are two different sets, and the rate
 * is "refunded orders / paid orders".
 */

export type OrderCountScope = 'paid' | 'all';

export interface OrderScopeDefinition {
  /** The scope's id. */
  id: OrderCountScope;
  /** The i18n key of the SHORT label (the badge). */
  labelKey: string;
  /** The i18n key of the EXPLANATION (the tooltip and the help text). */
  helpKey: string;
}

/**
 * The two scopes, in one table.
 *
 * `paid` is what the dashboard's overview endpoint counts. `all` is what the
 * Orders list shows. Nothing else may invent a third meaning.
 */
export const ORDER_COUNT_SCOPES: Record<OrderCountScope, OrderScopeDefinition> = {
  paid: {
    id: 'paid',
    labelKey: 'dashboard.orderScope.paid',
    helpKey: 'dashboard.orderScope.paidHelp',
  },
  all: {
    id: 'all',
    labelKey: 'orders.orderScope.all',
    helpKey: 'orders.orderScope.allHelp',
  },
};

/** The scope the DASHBOARD's order counts use. */
export const DASHBOARD_ORDER_SCOPE: OrderCountScope = 'paid';

/** The scope the ORDERS LIST's counts use. */
export const ORDERS_LIST_SCOPE: OrderCountScope = 'all';

/**
 * The scope as a phrase a reader can check against the list.
 *
 * The list of the EXCLUDED statuses is part of the sentence, because
 * "Excludes cancelled" is what a reader can verify on the Orders page.
 */
export const ORDER_SCOPE_EXCLUDED: readonly string[] = ['CANCELLED', 'PENDING', 'REFUNDED'];
