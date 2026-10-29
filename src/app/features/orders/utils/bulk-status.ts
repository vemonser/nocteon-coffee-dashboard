import { Observable, catchError, map, of } from 'rxjs';
import type { BulkStatusRowResult, OrderStatus } from '../models/order.model';
import { ORDER_STATUSES, canTransition } from '../models/order-status.model';

/**
 * The decision layer of the bulk status change (FE-18 / FE-18b).
 *
 * <p>Everything here is pure: which statuses a mixed selection may be moved
 * to, which rows a run would touch, what ONE bulk call answers, and what its
 * per-row outcomes add up to. The dialog renders what these return and the
 * list only sends the request, so the behaviour can be tested without a
 * browser.
 *
 * <p>The transitions are NEVER duplicated here — they come from
 * `order-status.model.ts`, the same map the single-order dialog uses. The
 * server stays the source of truth: a row the map allows can still be refused
 * (its `success` is false), and that refusal is reported per row.
 */

/** A row a bulk run can touch: its id, the number to name it by, its status now. */
export interface BulkStatusRow {
  id: number;
  orderNumber: string;
  status: OrderStatus;
}

/**
 * The statuses a BULK change offers.
 *
 * <p>`CANCELLED` is deliberately absent: cancelling an order has its own
 * dialog because it requires a reason and states a consequence, and a bulk
 * run has nowhere to ask for one reason per order. The dialog says so
 * instead of silently offering it.
 */
export const BULK_STATUS_ORDER: readonly OrderStatus[] = ORDER_STATUSES.filter(
  (status) => status !== 'CANCELLED',
);

/** One selectable status and the rows that can actually move to it. */
export interface BulkStatusChoice {
  status: OrderStatus;
  /** The selected rows that may move to it, in the order they were listed. */
  eligible: readonly BulkStatusRow[];
  /** How many selected rows the status would change. */
  count: number;
  /** False when no selected row can move to it — the dialog disables it. */
  enabled: boolean;
}

/**
 * The statuses to offer for a selection.
 *
 * <p>Every fulfilment status is returned, including the ones nobody can reach:
 * the dialog disables those and says why, which is more use than a dropdown
 * that silently hides half the vocabulary.
 */
export function bulkStatusChoices(rows: readonly BulkStatusRow[]): BulkStatusChoice[] {
  return BULK_STATUS_ORDER.map((status) => {
    const eligible = rows.filter((row) => canTransition(row.status, status));
    return { status, eligible, count: eligible.length, enabled: eligible.length > 0 };
  });
}

/** The selected rows a run to `status` would update. */
export function eligibleRows(
  rows: readonly BulkStatusRow[],
  status: OrderStatus,
): BulkStatusRow[] {
  return rows.filter((row) => canTransition(row.status, status));
}

/** The selected rows a run to `status` would skip. */
export function skippedRows(
  rows: readonly BulkStatusRow[],
  status: OrderStatus,
): BulkStatusRow[] {
  return rows.filter((row) => !canTransition(row.status, status));
}

/** What happened to one row. */
export interface BulkStatusResult {
  id: number;
  orderNumber: string;
  ok: boolean;
  /** Why it failed — the server's own message, or a translated fallback. */
  reason?: string;
}

/** How one bulk run talks to the API and to the screen. */
export interface BulkStatusSendOptions {
  /**
   * The ONE request: every id and the target status.
   *
   * <p>Before FE-18b this was a per-order call driven by `concatMap`; the
   * endpoint now takes the batch, so the run is a single round trip.
   */
  send: (ids: number[], status: OrderStatus) => Observable<readonly BulkStatusRowResult[]>;
  /** The reason a row reports when the server sends none. */
  fallbackReason: string;
  /** The reason for every row when the call was refused for permission. */
  deniedReason: string;
}

/** What one bulk call came back with. */
export interface BulkStatusOutcome {
  /** One outcome per row that was sent, in the order it was sent. */
  results: BulkStatusResult[];
  /**
   * The whole call failed and nothing ran (a 404 from an older backend, a
   * 501, a 500, a network failure): the list shows ONE error toast and keeps
   * the selection. Null when the call answered.
   */
  error: unknown | null;
}

/**
 * Send one status change for the whole selection — ONE REQUEST.
 *
 * <p>The server answers every id it was sent, so the per-row outcomes are the
 * server's own: its message is what the failures dialog shows. Two cases are
 * the client's to decide:
 *
 * <ul>
 *   <li>`403` — a permission error is not per-row, so every row is reported as
 *       refused with `deniedReason`. No second toast: the interceptor already
 *       showed the one permission message, and the loop that used to send
 *       eleven more requests is gone.</li>
 *   <li>anything else — the call did not run at all, so there is no per-row
 *       story to tell. `error` carries the failure and the list shows one
 *       toast, with no retry loop.</li>
 * </ul>
 */
export function sendBulkStatus(
  rows: readonly BulkStatusRow[],
  status: OrderStatus,
  options: BulkStatusSendOptions,
): Observable<BulkStatusOutcome> {
  if (rows.length === 0) return of({ results: [], error: null });

  return options.send(
    rows.map((row) => row.id),
    status,
  ).pipe(
    map((answer) => ({ results: toRowResults(rows, answer, options.fallbackReason), error: null })),
    catchError((err: unknown) => {
      if ((err as { status?: number } | null)?.status === 403) {
        return of({
          results: rows.map(
            (row): BulkStatusResult => ({
              id: row.id,
              orderNumber: row.orderNumber,
              ok: false,
              reason: options.deniedReason,
            }),
          ),
          error: null,
        });
      }
      return of({ results: [] as BulkStatusResult[], error: err });
    }),
  );
}

/**
 * The server's answer, shaped for the screen.
 *
 * <p>A row the server did not answer for is a FAILURE, not a success: it is
 * still selected, and the dialog must not claim it moved. The order number
 * comes from the server when it has one (an id that is not an order has
 * none) and from the row the dashboard sent otherwise.
 */
function toRowResults(
  rows: readonly BulkStatusRow[],
  answer: readonly BulkStatusRowResult[],
  fallbackReason: string,
): BulkStatusResult[] {
  const byId = new Map(answer.map((row) => [row.id, row]));
  return rows.map((row) => {
    const result = byId.get(row.id);
    return {
      id: row.id,
      orderNumber:
        result?.orderNumber && result.orderNumber.length > 0
          ? result.orderNumber
          : row.orderNumber,
      ok: result?.success === true,
      reason:
        result?.success === true
          ? undefined
          : result?.message && result.message.length > 0
            ? result.message
            : fallbackReason,
    };
  });
}

/** A run's outcomes, added up. */
export interface BulkStatusSummary {
  updated: number;
  failed: number;
  updatedIds: number[];
  failedIds: number[];
  /** The failures, in the order they were attempted (for the readable list). */
  failures: BulkStatusResult[];
  allSucceeded: boolean;
  noneSucceeded: boolean;
}

/** Add up the per-row outcomes of a run. */
export function summarizeBulkStatus(
  results: readonly BulkStatusResult[],
): BulkStatusSummary {
  const failures = results.filter((result) => !result.ok);
  const updated = results.length - failures.length;
  return {
    updated,
    failed: failures.length,
    updatedIds: results.filter((result) => result.ok).map((result) => result.id),
    failedIds: failures.map((result) => result.id),
    failures,
    allSucceeded: results.length > 0 && failures.length === 0,
    noneSucceeded: results.length > 0 && updated === 0,
  };
}

/**
 * What the one toast after a run says.
 *
 * <p>Three outcomes, three messages, one toast:
 *  - everything moved: "12 orders updated";
 *  - some moved: the same count, plus a line naming the ones that did not;
 *  - nothing moved: the failure count, because "0 orders updated" tells
 *    nobody anything.
 *
 * <p>`messageBase`/`failureBase` are plural families (`<base>_one`,
 * `<base>_two`, …), so the wording follows the grammar of the active
 * language instead of being glued together in TypeScript.
 */
export interface BulkStatusToast {
  tone: 'success' | 'warning';
  messageBase: string;
  /** The count the headline is about. */
  count: number;
  /** The plural family of the failure line, or null when nothing failed. */
  failureBase: string | null;
  failureCount: number;
  /** Open the per-row list without making the reader hunt for it. */
  openFailures: boolean;
}

export function bulkStatusToast(summary: BulkStatusSummary): BulkStatusToast {
  if (summary.failed === 0) {
    return {
      tone: 'success',
      messageBase: 'orders.bulk.updated',
      count: summary.updated,
      failureBase: null,
      failureCount: 0,
      openFailures: false,
    };
  }
  if (summary.updated === 0) {
    return {
      tone: 'warning',
      messageBase: 'orders.bulk.failed',
      count: summary.failed,
      failureBase: null,
      failureCount: 0,
      openFailures: true,
    };
  }
  return {
    tone: 'warning',
    messageBase: 'orders.bulk.updated',
    count: summary.updated,
    failureBase: 'orders.bulk.failed',
    failureCount: summary.failed,
    openFailures: true,
  };
}
