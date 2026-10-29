import { Observable, from, of } from 'rxjs';
import { catchError, concatMap, map, tap, toArray } from 'rxjs';
import type { OrderStatus } from '../models/order.model';
import { ORDER_STATUSES, canTransition } from '../models/order-status.model';

/**
 * The decision layer of the bulk status change (FE-18).
 *
 * <p>Everything here is pure: which statuses a mixed selection may be moved
 * to, which rows a run would touch, and what a run's per-row outcomes add up
 * to. The dialog renders what these return and the list only sends requests,
 * so the behaviour can be tested without a browser.
 *
 * <p>The transitions are NEVER duplicated here — they come from
 * `order-status.model.ts`, the same map the single-order dialog uses. The
 * server stays the source of truth: a row the map allows can still be refused
 * (`4xx`), and that refusal is reported per row.
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
export interface BulkStatusRunOptions {
  /** The per-order call. The run calls it ONE ROW AT A TIME. */
  update: (row: BulkStatusRow) => Observable<unknown>;
  /** The reason a row reports when the server sends none. */
  fallbackReason: string;
  /** The reason for a row the run never attempted (it stopped on a 403). */
  abortedReason: string;
  /** How far the run has got, so the dialog can say "3 of 12". */
  onProgress?: (done: number, total: number) => void;
  /** Pull the server's own message out of a failure (the app's NotifyService does). */
  backendMessage?: (err: unknown) => string | null;
}

/**
 * Run one status change over the selection — SEQUENTIALLY.
 *
 * <p>`concatMap` is the point of this function: the next request is not
 * started until the previous one has settled, so twelve rows are twelve
 * requests in order instead of twelve parallel requests against an endpoint
 * that has no bulk operation.
 *
 * <p>A refused row does not abort the run — the server is the source of truth
 * per order, so its message is recorded and the next row runs. The one
 * exception is `403`: a permission error is not per-row, so the run stops and
 * every remaining row is reported as "not attempted" (which also keeps the
 * interceptor's permission toast to exactly one).
 */
export function runBulkStatus(
  rows: readonly BulkStatusRow[],
  options: BulkStatusRunOptions,
): Observable<BulkStatusResult[]> {
  const total = rows.length;
  const backendMessage = options.backendMessage ?? (() => null);
  let done = 0;
  let aborted = false;

  return from(rows).pipe(
    concatMap((row) => {
      if (aborted) {
        return of<BulkStatusResult>({
          id: row.id,
          orderNumber: row.orderNumber,
          ok: false,
          reason: options.abortedReason,
        });
      }
      return options.update(row).pipe(
        map((): BulkStatusResult => ({ id: row.id, orderNumber: row.orderNumber, ok: true })),
        catchError((err: unknown) => {
          if ((err as { status?: number } | null)?.status === 403) aborted = true;
          return of<BulkStatusResult>({
            id: row.id,
            orderNumber: row.orderNumber,
            ok: false,
            reason: backendMessage(err) ?? options.fallbackReason,
          });
        }),
        tap(() => {
          done += 1;
          options.onProgress?.(done, total);
        }),
      );
    }),
    toArray(),
  );
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
