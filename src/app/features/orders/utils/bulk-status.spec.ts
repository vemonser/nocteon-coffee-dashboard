import { describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  BULK_STATUS_ORDER,
  bulkStatusChoices,
  bulkStatusToast,
  eligibleRows,
  sendBulkStatus,
  skippedRows,
  summarizeBulkStatus,
  type BulkStatusOutcome,
  type BulkStatusResult,
  type BulkStatusRow,
} from './bulk-status';
import type { BulkStatusRowResult } from '../models/order.model';
import { ALLOWED_TRANSITIONS } from '../models/order-status.model';

/**
 * FE-18 / FE-18b — the decisions a bulk status run makes without a browser.
 *
 * These tests are the contract of the bulk dialog and the toast:
 *  - only statuses the SHARED transition map allows may be offered, and a
 *    status nobody can reach is still listed (disabled), never invented;
 *  - the run is ONE request whose per-row answer is mapped onto the outcomes
 *    the dialog shows — including the rows the server refused;
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

describe('sendBulkStatus', () => {
  const rows = [row(1, 'PENDING'), row(2, 'PENDING'), row(3, 'PENDING')];

  /** Collect what the run answers with (the API's `of()` is synchronous). */
  function run(
    sent: readonly BulkStatusRow[],
    status: BulkStatusRow['status'],
    options: Partial<Parameters<typeof sendBulkStatus>[2]> & {
      answer?: readonly BulkStatusRowResult[];
      fail?: unknown;
    } = {},
  ) {
    const calls: Array<{ ids: number[]; status: string }> = [];
    let outcome: BulkStatusOutcome | null = null;

    sendBulkStatus(sent, status, {
      send: (ids, target) => {
        calls.push({ ids, status: target });
        return options.fail !== undefined
          ? throwError(() => options.fail)
          : of(options.answer ?? []);
      },
      fallbackReason: options.fallbackReason ?? 'Could not update',
      deniedReason: options.deniedReason ?? 'Denied',
    }).subscribe((value) => (outcome = value));

    return { calls, outcome: outcome as unknown as BulkStatusOutcome };
  }

  const answered = (id: number, success: boolean, message: string | null = null) => ({
    id,
    orderNumber: `ORD-2026-00000${id}`,
    success,
    message,
  });

  it('sends ONE request carrying every id and the target status', () => {
    const { calls } = run(rows, 'CONFIRMED', {
      answer: rows.map((r) => answered(r.id, true)),
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ ids: [1, 2, 3], status: 'CONFIRMED' });
  });

  it('maps the server rows onto the outcomes the dialog shows', () => {
    const { outcome } = run(rows, 'CONFIRMED', {
      answer: [
        answered(1, true),
        answered(2, false, 'Cannot change order status from CONFIRMED to CONFIRMED'),
        answered(3, true),
      ],
    });

    expect(outcome.error).toBeNull();
    expect(outcome.results).toEqual([
      { id: 1, orderNumber: 'ORD-2026-000001', ok: true, reason: undefined },
      {
        id: 2,
        orderNumber: 'ORD-2026-000002',
        ok: false,
        reason: 'Cannot change order status from CONFIRMED to CONFIRMED',
      },
      { id: 3, orderNumber: 'ORD-2026-000003', ok: true, reason: undefined },
    ]);
  });

  it('keeps the row it sent when the server has no number to give', () => {
    // An id that is not an order comes back with orderNumber: null.
    const { outcome } = run([row(7, 'PENDING')], 'CONFIRMED', {
      answer: [{ id: 7, orderNumber: null, success: false, message: 'Order not found' }],
    });

    expect(outcome.results).toEqual([
      { id: 7, orderNumber: 'ORD-2026-000007', ok: false, reason: 'Order not found' },
    ]);
  });

  it('falls back to the app wording when the server sends no message', () => {
    const { outcome } = run([row(1, 'PENDING')], 'CONFIRMED', {
      answer: [{ id: 1, orderNumber: null, success: false, message: null }],
    });

    expect(outcome.results[0].ok).toBe(false);
    expect(outcome.results[0].reason).toBe('Could not update');
  });

  it('does not call a row a success when the server never answered for it', () => {
    // A missing row must stay selected: claiming it moved would hide it.
    const { outcome } = run(rows, 'CONFIRMED', { answer: [answered(1, true)] });

    expect(outcome.results.map((result) => result.ok)).toEqual([true, false, false]);
    expect(outcome.results[2].reason).toBe('Could not update');
  });

  it('reports a 403 as every row refused, in ONE request and without an error toast', () => {
    const { calls, outcome } = run(rows, 'CONFIRMED', { fail: { status: 403 } });

    // One refusal, not three: the interceptor's permission toast stays one.
    expect(calls).toHaveLength(1);
    expect(outcome.error).toBeNull();
    expect(outcome.results).toEqual([
      { id: 1, orderNumber: 'ORD-2026-000001', ok: false, reason: 'Denied' },
      { id: 2, orderNumber: 'ORD-2026-000002', ok: false, reason: 'Denied' },
      { id: 3, orderNumber: 'ORD-2026-000003', ok: false, reason: 'Denied' },
    ]);
  });

  it.each([404, 501, 500])(
    'reports a %i for the whole call as ONE error, with no per-row story and no retry',
    (status) => {
      const { calls, outcome } = run(rows, 'CONFIRMED', { fail: { status } });

      expect(calls).toHaveLength(1);
      expect(outcome.error).toEqual({ status });
      // Nothing ran, so nothing may be reported as failed per row.
      expect(outcome.results).toEqual([]);
    },
  );

  it('makes no request when the selection is empty', () => {
    const { calls, outcome } = run([], 'CONFIRMED');
    expect(calls).toEqual([]);
    expect(outcome).toEqual({ results: [], error: null });
  });

  it('summarises the same way the sequential run did', () => {
    // The AGGREGATION is what the screen shows, and it must not depend on how
    // the requests were sent.
    const { outcome } = run(rows, 'CONFIRMED', {
      answer: [answered(1, true), answered(2, false, 'Refused'), answered(3, false, 'Refused')],
    });
    const summary = summarizeBulkStatus(outcome.results);
    expect(summary.updated).toBe(1);
    expect(summary.failed).toBe(2);
    expect(summary.failedIds).toEqual([2, 3]);
  });
});

