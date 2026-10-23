/**
 * THE definition of what an order COUNT means.
 *
 * The dashboard said "10 orders" and the Orders page said "17 orders", and
 * both numbers were right — they counted different things:
 *
 *   - the dashboard counts the orders the backend's overview endpoint
 *     counts: the orders whose PAYMENT STATUS is PAID. The order's own
 *     status does not decide it — an order that is DELIVERED and REFUNDED
 *     is not counted either, because its payment is not PAID any more.
 *   - the Orders list counts every order the store has, whatever its
 *     status and whatever its payment status.
 *
 * A reader cannot reconcile the two numbers unless the page says which set
 * it is counting. So the rule lives HERE, once, and both surfaces read it:
 *
 *   - the label ("Paid orders" / "All orders"),
 *   - the explanation ("an order is counted when its payment status is
 *     Paid — pending, failed and refunded orders are not counted"),
 *   - and the same words in the same order in both languages.
 *
 * WHY THE PAYMENT STATUS, NOT THE ORDER STATUS
 * ---------------------------------------------
 * The two are independent fields, and a CANCELLED order can be REFUNDED
 * (one in the seed is: `ORD-2026-000012`). Naming the order statuses
 * would therefore be wrong twice over: it would leave the refunded
 * DELIVERED order out of the sentence, and it would count a cancelled
 * order twice. The payment status is the field the backend filters on, so
 * it is the field the sentence names.
 *
 * The refund rate uses a RELATED denominator: refunded orders out of every
 * order that reached a paid state (paid + refunded). Its help text points at
 * this definition instead of repeating it.
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
 * The PAYMENT STATUSES the `paid` scope leaves out.
 *
 * These are the payment statuses, not the order statuses — see the note
 * above. The sentence in the locale files names them, and the evidence
 * script checks that the data agrees.
 */
export const ORDER_SCOPE_EXCLUDED_PAYMENT_STATUSES: readonly string[] = [
  'PENDING',
  'FAILED',
  'REFUNDED',
];

/**
 * The definition of the scope, for a surface that needs the whole thing.
 *
 * The components read this instead of indexing the table with a literal,
 * so the two surfaces cannot drift apart.
 */
export function orderScopeDefinition(
  scope: OrderCountScope,
): OrderScopeDefinition {
  return ORDER_COUNT_SCOPES[scope];
}
