/**
 * The rules a manual stock adjustment has to satisfy, as plain functions.
 *
 * Extracted from the dialog so the rules can be tested without a TestBed and so
 * the dialog cannot drift from what it says: "Save stays disabled until the form
 * is dirty and valid" is `canAdjust` in one place.
 */

/** A parsed delta, or null when the field holds nothing usable. */
export function parseDelta(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const delta = Number(value);
  return Number.isFinite(delta) ? delta : null;
}

/**
 * The stock the change would leave behind.
 *
 * Null when there is nothing to preview: no number, no change, or a result
 * below zero — the same three cases the server refuses, refused here first so
 * the admin sees the rule instead of a 400.
 */
export function previewStock(stock: number, delta: number | null): number | null {
  if (delta === null || delta === 0) return null;
  const next = stock + delta;
  return next < 0 ? null : next;
}

/**
 * May this adjustment be sent?
 *
 * @param reason the admin's sentence, trimmed before the check — spaces are not
 *               a reason, and the backend would refuse them anyway
 */
export function canAdjust(stock: number, delta: number | null, reason: string, pending: boolean): boolean {
  if (pending) return false;
  if (previewStock(stock, delta) === null) return false;
  return reason.trim().length > 0;
}
