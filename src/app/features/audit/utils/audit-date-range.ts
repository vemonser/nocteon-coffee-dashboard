/**
 * The audit page's date filter, as the API wants it.
 *
 * <p>The two controls are `<input type="date">`, which speaks a LOCAL calendar
 * day (`YYYY-MM-DD`). The endpoint takes ISO instants, and "the 3rd" means the
 * reader's 3rd — the store's time zone — so the day is widened here: the start
 * of the local day and the last millisecond of the local day.
 *
 * <p>Slicing the date and appending `T00:00:00Z` would silently shift a Cairo
 * reader's day by two hours, and the first two hours of their morning would
 * land in the previous day.
 */

/** The first instant of a local calendar day, as an ISO instant. */
export function startOfDayIso(date: string | null | undefined): string | undefined {
  const parts = splitDate(date);
  if (!parts) return undefined;
  return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0).toISOString();
}

/** The last instant of a local calendar day, as an ISO instant. */
export function endOfDayIso(date: string | null | undefined): string | undefined {
  const parts = splitDate(date);
  if (!parts) return undefined;
  return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999).toISOString();
}

/**
 * A day the reader picked, or undefined.
 *
 * <p>An empty field and an unparseable value both mean "no bound" — a filter
 * box must never turn a half-typed date into a request.
 */
function splitDate(date: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject a day that does not exist in that month (2026-02-31).
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return { year, month, day };
}
