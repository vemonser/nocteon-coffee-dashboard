import type { OrderStatus } from '../models/order.model';

/**
 * One thing that happened to an order, as the page draws it.
 *
 * <p>This is a VIEW model: it is built from recorded API fields only. It
 * never invents a transition, a date or an actor — a source that the
 * backend does not record simply contributes no event.
 */
export type OrderEventKind =
  | 'placed'
  | 'status'
  | 'payment'
  | 'shipment'
  | 'refund'
  | 'return'
  | 'note'
  | 'email';

export interface OrderEvent {
  id: string;
  kind: OrderEventKind;
  /** ISO timestamp. Every event has one; an undated source is not an event. */
  at: string;
  /** The status moved FROM this value. Null for the order being placed. */
  fromStatus?: OrderStatus | null;
  /** The status moved TO this value. */
  toStatus?: OrderStatus;
  /** Who did it: an admin e-mail, the system, or the note's author. */
  actor?: string | null;
  /** A free-text detail: a status note, a refund reason, a note body. */
  detail?: string | null;
  /** Money attached to the event (a refund). */
  amount?: number | null;
  /** Which shipment milestone this is. */
  shipmentStage?: 'shipped' | 'delivered';
  /**
   * Which RETURN event this is (`RETURN_REQUESTED`, `RETURN_APPROVED`,
   * `RETURN_REJECTED`) — the value the backend stored in `eventType`, so the
   * page can title the row without inventing a status.
   */
  returnEvent?: string;
  /** Was the customer to be told? */
  notify?: boolean;
}

export interface OrderActivitySources {
  order: {
    createdAt: string;
  };
  history?: ReadonlyArray<{
    id: number;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    changedBy: string | null;
    notifyCustomer: boolean;
    /** Set on an EVENT row (a return); null on a status change. */
    eventType?: string | null;
    createdAt: string;
  }>;
  notes?: ReadonlyArray<{
    id: number;
    body: string;
    author: string;
    createdAt: string;
  }>;
  refunds?: ReadonlyArray<{
    id: number;
    amount: number;
    reason: string | null;
    createdBy: string | null;
    createdAt: string;
  }>;
  payment?: {
    paidAt: string | null;
    amount: number | null;
  } | null;
  shipment?: {
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
}

/**
 * Build the activity log, newest first.
 *
 * <p>Sources, and what each contributes:
 * <ul>
 *   <li><b>placed</b> — the order's own `createdAt`. A real timestamp, not a
 *       manufactured transition; suppressed when the status history already
 *       has a "from nothing" row, which is the same fact.</li>
 *   <li><b>status</b> — each history row, with from → to, actor and note.</li>
 *   <li><b>payment</b> — only when the payment has a `paidAt`; an undated
 *       "paid" flag cannot be placed on a timeline.</li>
 *   <li><b>shipment</b> — the shipped-at and delivered-at stamps.</li>
 *   <li><b>refund</b> — each refund line.</li>
 *   <li><b>note</b> — each internal note.</li>
 *   <li><b>email</b> — no backend source exists, so none are emitted. The
 *       moment an endpoint records sent mail, it belongs here.</li>
 * </ul>
 */
export function buildOrderEvents(sources: OrderActivitySources): OrderEvent[] {
  const events: OrderEvent[] = [];
  const history = sources.history ?? [];

  // A row with an `eventType` is an EVENT, not a transition (a return). It
  // must not be read as "the status changed", and its `toStatus` is the
  // order's status AT THE TIME — so it is kept out of every transition test
  // below and drawn, with its own title, further down.
  const transitions = history.filter((entry) => !entry.eventType);

  const historyHasPlacedRow = transitions.some((entry) => entry.fromStatus === null);
  if (!historyHasPlacedRow && sources.order.createdAt) {
    events.push({
      id: 'placed',
      kind: 'placed',
      at: sources.order.createdAt,
    });
  }

  for (const entry of transitions) {
    events.push({
      id: `history-${entry.id}`,
      kind: 'status',
      at: entry.createdAt,
      fromStatus: (entry.fromStatus as OrderStatus | null) ?? null,
      toStatus: entry.toStatus as OrderStatus,
      actor: entry.changedBy,
      detail: entry.note,
      notify: entry.notifyCustomer,
    });
  }

  // The returns of the order: the backend records each one as a row of the
  // SAME history the status chain uses, with `eventType` naming the event.
  // The title is the event, the detail is the line summary the backend wrote
  // ("2 × Ethiopia Yirgacheffe"), and the actor is who did it.
  for (const entry of history) {
    if (!entry.eventType) continue;
    events.push({
      id: `return-${entry.id}`,
      kind: 'return',
      at: entry.createdAt,
      actor: entry.changedBy,
      detail: entry.note,
      returnEvent: entry.eventType,
    });
  }

  if (sources.payment?.paidAt) {
    events.push({
      id: 'payment-paid',
      kind: 'payment',
      at: sources.payment.paidAt,
      amount: sources.payment.amount,
    });
  }

  // A shipment stamp that duplicates a status transition the history already
  // records is folded into that transition's row instead of becoming a second
  // line ("Shipped → Delivered" and "Shipment delivered" are the same event).
  const hasShippedTransition = transitions.some(
    (entry) => entry.toStatus === 'SHIPPED',
  );
  const hasDeliveredTransition = transitions.some(
    (entry) => entry.toStatus === 'DELIVERED',
  );

  if (sources.shipment?.shippedAt && !hasShippedTransition) {
    events.push({
      id: 'shipment-shipped',
      kind: 'shipment',
      at: sources.shipment.shippedAt,
      shipmentStage: 'shipped',
    });
  }

  if (sources.shipment?.deliveredAt && !hasDeliveredTransition) {
    events.push({
      id: 'shipment-delivered',
      kind: 'shipment',
      at: sources.shipment.deliveredAt,
      shipmentStage: 'delivered',
    });
  }

  for (const refund of sources.refunds ?? []) {
    events.push({
      id: `refund-${refund.id}`,
      kind: 'refund',
      at: refund.createdAt,
      amount: refund.amount,
      detail: refund.reason,
      actor: refund.createdBy,
    });
  }

  for (const note of sources.notes ?? []) {
    events.push({
      id: `note-${note.id}`,
      kind: 'note',
      at: note.createdAt,
      detail: note.body,
      actor: note.author,
    });
  }

  // Newest first, compared as INSTANTS. An ISO timestamp is not lexicographic
  // when the offsets differ (`…T05:00:00+02:00` is earlier than
  // `…T04:00:00Z`), so `Date.parse` decides the order and a malformed value
  // sorts to the oldest end instead of throwing.
  const instant = (value: string): number => {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
  };
  return events.sort((a, b) => instant(b.at) - instant(a.at));
}
