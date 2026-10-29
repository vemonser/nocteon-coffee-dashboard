import { describe, expect, it } from 'vitest';
import { Subject, of, throwError } from 'rxjs';
import {
  BULK_STATUS_ORDER,
  bulkStatusChoices,
  bulkStatusToast,
  eligibleRows,
  runBulkStatus,
  skippedRows,
  summarizeBulkStatus,
  type BulkStatusResult,
  type BulkStatusRow,
} from './bulk-status';
import { ALLOWED_TRANSITIONS } from '../models/order-status.model';

/**
 * FE-18 — the decisions a bulk status run makes without a browser.
 *
 * These tests are the contract of the bulk dialog and the toast:
 *  - only statuses the SHARED transition map allows may be offered, and a
 *    status nobody can reach is still listed (disabled), never invented;
 *  - a run that partly fails reports the failures per row and keeps them;
 *  - a fully successful run clears; the one toast says what happened.
 */

const row = (id: number, status: BulkStatusRow['status']): BulkStatusRow => ({
  id,
  orderNumber: `ORD-2026-00000${id}`,
  status,
});

const result = (id: number, ok: boolean, reason?: string): BulkStatusResult => ({
  id,
  orderNumber: `ORD-2026-00000${id}`,
  ok,
  reason,
});

describe('bulkStatusChoices', () => {
  it('offers the fulfilment vocabulary and never Cancelled', () => {
    expect(BULK_STATUS_ORDER).toEqual([
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
    ]);
    // Cancelling needs one reason per order, so it keeps its own dialog.
    expect(BULK_STATUS_ORDER).not.toContain('CANCELLED');
  });

  it('counts the rows each status can actually move, from the shared map', () => {
    const rows = [
      row(1, 'PENDING'),
      row(2, 'PENDING'),
      row(3, 'CONFIRMED'),
      row(4, 'SHIPPED'),
      row(5, 'DELIVERED'),
      row(6, 'CANCELLED'),
    ];
    const choices = bulkStatusChoices(rows);
    const byStatus = Object.fromEntries(choices.map((c) => [c.status, c]));

    // PENDING -> CONFIRMED | CANCELLED ; CONFIRMED -> PROCESSING | CANCELLED
    expect(byStatus['CONFIRMED'].count).toBe(2);
    expect(byStatus['CONFIRMED'].eligible.map((r) => r.id)).toEqual([1, 2]);
    expect(byStatus['PROCESSING'].count).toBe(1);
    expect(byStatus['PROCESSING'].eligible.map((r) => r.id)).toEqual([3]);
    expect(byStatus['SHIPPED'].count).toBe(0);
    expect(byStatus['SHIPPED'].enabled).toBe(false);
    expect(byStatus['DELIVERED'].count).toBe(1);
    expect(byStatus['DELIVERED'].eligible.map((r) => r.id)).toEqual([4]);

    // A status nobody in the selection can reach is still LISTED, disabled.
    const pending = byStatus['PENDING'];
    expect(pending.count).toBe(0);
    expect(pending.enabled).toBe(false);
  });

  it('marks every status disabled when the selection is terminal', () => {
    const choices = bulkStatusChoices([row(1, 'DELIVERED'), row(2, 'CANCELLED')]);
    expect(choices).toHaveLength(5);
    expect(choices.every((choice) => !choice.enabled && choice.count === 0)).toBe(true);
    expect(choices.some((choice) => choice.enabled)).toBe(false);
  });

  it('offers nothing when the selection is empty', () => {
    const choices = bulkStatusChoices([]);
    expect(choices.map((c) => c.count)).toEqual([0, 0, 0, 0, 0]);
    expect(choices.some((c) => c.enabled)).toBe(false);
  });

  it('describes every offered status with the shared transition map', () => {
    // No transition is invented: a status is enabled for a row only when
    // ALLOWED_TRANSITIONS says so — for every starting status.
    for (const [source, allowed] of Object.entries(ALLOWED_TRANSITIONS)) {
      const choices = bulkStatusChoices([row(1, source as BulkStatusRow['status'])]);
      for (const status of BULK_STATUS_ORDER) {
        const choice = choices.find((c) => c.status === status)!;
        expect(choice.enabled, `${source} -> ${status}`).toBe(allowed.includes(status));
      }
    }
  });
});

describe('eligibleRows / skippedRows', () => {
  const rows = [row(1, 'PENDING'), row(2, 'DELIVERED'), row(3, 'CONFIRMED')];

  it('splits the selection into the rows a run touches and the rows it skips', () => {
    expect(eligibleRows(rows, 'CONFIRMED').map((r) => r.id)).toEqual([1]);
    expect(skippedRows(rows, 'CONFIRMED').map((r) => r.id)).toEqual([2, 3]);
  });

  it('keeps the order of the selection', () => {
    // Nothing transitions INTO Pending, so a run to it touches no row.
    expect(eligibleRows(rows, 'PENDING')).toEqual([]);
    expect(
      eligibleRows([row(9, 'PENDING'), row(4, 'PENDING')], 'CONFIRMED').map((r) => r.id),
    ).toEqual([9, 4]);
  });
});

describe('summarizeBulkStatus', () => {
  it('adds up a fully successful run', () => {
    const summary = summarizeBulkStatus([result(1, true), result(2, true), result(3, true)]);
    expect(summary.updated).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.updatedIds).toEqual([1, 2, 3]);
    expect(summary.failedIds).toEqual([]);
    expect(summary.failures).toEqual([]);
    expect(summary.allSucceeded).toBe(true);
    expect(summary.noneSucceeded).toBe(false);
  });

  it('keeps each failure with its order number and reason, in order', () => {
    const summary = summarizeBulkStatus([
      result(1, true),
      result(2, false, 'Order is already confirmed'),
      result(3, true),
      result(4, false, 'Not attempted — the run stopped after a permission error.'),
    ]);
    expect(summary.updated).toBe(2);
    expect(summary.failed).toBe(2);
    expect(summary.updatedIds).toEqual([1, 3]);
    expect(summary.failedIds).toEqual([2, 4]);
    expect(summary.failures).toEqual([
      { id: 2, orderNumber: 'ORD-2026-000002', ok: false, reason: 'Order is already confirmed' },
      {
        id: 4,
        orderNumber: 'ORD-2026-000004',
        ok: false,
        reason: 'Not attempted — the run stopped after a permission error.',
      },
    ]);
    expect(summary.allSucceeded).toBe(false);
    expect(summary.noneSucceeded).toBe(false);
  });

  it('reports a run where every row failed', () => {
    const summary = summarizeBulkStatus([result(1, false, 'Refused'), result(2, false, 'Refused')]);
    expect(summary.updated).toBe(0);
    expect(summary.failed).toBe(2);
    expect(summary.failedIds).toEqual([1, 2]);
    expect(summary.noneSucceeded).toBe(true);
  });

  it('does not call an empty run a success', () => {
    const summary = summarizeBulkStatus([]);
    expect(summary.updated).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.allSucceeded).toBe(false);
    expect(summary.noneSucceeded).toBe(false);
  });
});

describe('bulkStatusToast', () => {
  it('is ONE success carrying the count when everything moved', () => {
    const plan = bulkStatusToast(summarizeBulkStatus([result(1, true), result(2, true)]));
    expect(plan).toEqual({
      tone: 'success',
      messageBase: 'orders.bulk.updated',
      count: 2,
      failureBase: null,
      failureCount: 0,
      openFailures: false,
    });
  });

  it('adds the failure count and opens the per-row list on a partial run', () => {
    const plan = bulkStatusToast(
      summarizeBulkStatus([result(1, true), result(2, true), result(3, false, 'Refused')]),
    );
    expect(plan.tone).toBe('warning');
    expect(plan.messageBase).toBe('orders.bulk.updated');
    expect(plan.count).toBe(2);
    expect(plan.failureBase).toBe('orders.bulk.failed');
    expect(plan.failureCount).toBe(1);
    expect(plan.openFailures).toBe(true);
  });

  it('counts the failures, not "0 orders updated", when nothing moved', () => {
    const plan = bulkStatusToast(
      summarizeBulkStatus([result(1, false, 'Refused'), result(2, false, 'Refused')]),
    );
    expect(plan.tone).toBe('warning');
    expect(plan.messageBase).toBe('orders.bulk.failed');
    expect(plan.count).toBe(2);
    expect(plan.failureBase).toBeNull();
    expect(plan.openFailures).toBe(true);
  });
});

describe('runBulkStatus', () => {
  const rows = [row(1, 'PENDING'), row(2, 'PENDING'), row(3, 'PENDING')];

  /** A per-order call the test settles by hand, so "in flight" is observable. */
  function controlledRun(count: number) {
    const calls: number[] = [];
    const subjects: Subject<unknown>[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const progress: Array<{ done: number; total: number }> = [];

    const run = runBulkStatus(rows.slice(0, count), {
      update: (r) => {
        calls.push(r.id);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        const subject = new Subject<unknown>();
        subjects.push(subject);
        subject.subscribe({
          complete: () => {
            inFlight -= 1;
          },
        });
        return subject;
      },
      fallbackReason: 'Could not update',
      abortedReason: 'Not attempted',
      onProgress: (done, total) => progress.push({ done, total }),
    });

    return { run, calls, subjects, progress, maxInFlight: () => maxInFlight };
  }

  it('sends ONE request at a time, in the order of the selection', () => {
    const { run, calls, subjects, maxInFlight } = controlledRun(3);
    const results: BulkStatusResult[] = [];
    run.subscribe((value) => results.push(...value));

    // The first row is asked; nothing else is until it settles.
    expect(calls).toEqual([1]);

    subjects[0].next(null);
    subjects[0].complete();
    expect(calls).toEqual([1, 2]);

    subjects[1].next(null);
    subjects[1].complete();
    subjects[2].next(null);
    subjects[2].complete();

    expect(calls).toEqual([1, 2, 3]);
    expect(maxInFlight()).toBe(1);
    expect(results.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('records a refused row and keeps going', () => {
    const calls: number[] = [];
    const run = runBulkStatus(rows, {
      update: (r) => {
        calls.push(r.id);
        return r.id === 2
          ? throwError(() => ({ status: 400, error: { message: 'Order is already confirmed' } }))
          : of(null);
      },
      fallbackReason: 'Could not update',
      abortedReason: 'Not attempted',
      backendMessage: (err) => (err as { error?: { message?: string } })?.error?.message ?? null,
    });

    let results: BulkStatusResult[] = [];
    run.subscribe((value) => (results = [...value]));

    expect(calls).toEqual([1, 2, 3]);
    expect(results).toEqual([
      { id: 1, orderNumber: 'ORD-2026-000001', ok: true },
      {
        id: 2,
        orderNumber: 'ORD-2026-000002',
        ok: false,
        reason: 'Order is already confirmed',
      },
      { id: 3, orderNumber: 'ORD-2026-000003', ok: true },
    ]);
  });

  it('falls back to the app wording when the server sends no message', () => {
    const run = runBulkStatus([row(1, 'PENDING')], {
      update: () => throwError(() => ({ status: 500 })),
      fallbackReason: 'Could not update',
      abortedReason: 'Not attempted',
      backendMessage: () => null,
    });

    let results: BulkStatusResult[] = [];
    run.subscribe((value) => (results = [...value]));
    expect(results[0].reason).toBe('Could not update');
    expect(results[0].ok).toBe(false);
  });

  it('STOPS on a 403 instead of firing the rest, and reports them as not attempted', () => {
    const calls: number[] = [];
    const run = runBulkStatus(rows, {
      update: (r) => {
        calls.push(r.id);
        return throwError(() => ({ status: 403 }));
      },
      fallbackReason: 'Could not update',
      abortedReason: 'Not attempted after a permission error',
      backendMessage: () => null,
    });

    let results: BulkStatusResult[] = [];
    run.subscribe((value) => (results = [...value]));

    // One refusal, not three: the permission toast stays a single toast.
    expect(calls).toEqual([1]);
    expect(results).toEqual([
      { id: 1, orderNumber: 'ORD-2026-000001', ok: false, reason: 'Could not update' },
      { id: 2, orderNumber: 'ORD-2026-000002', ok: false, reason: 'Not attempted after a permission error' },
      { id: 3, orderNumber: 'ORD-2026-000003', ok: false, reason: 'Not attempted after a permission error' },
    ]);
  });

  it('reports progress one row at a time', () => {
    const progress: Array<{ done: number; total: number }> = [];
    const run = runBulkStatus(rows, {
      update: () => of(null),
      fallbackReason: 'Could not update',
      abortedReason: 'Not attempted',
      onProgress: (done, total) => progress.push({ done, total }),
    });

    run.subscribe();
    expect(progress).toEqual([
      { done: 1, total: 3 },
      { done: 2, total: 3 },
      { done: 3, total: 3 },
    ]);
  });
});
