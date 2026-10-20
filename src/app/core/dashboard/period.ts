/**
 * Period arithmetic for the dashboard.
 *
 * The dashboard compares a "current" window against the window immediately
 * before it. Two rules make that comparison honest:
 *
 *  1. Both windows contain the SAME number of days.
 *  2. The windows do not overlap. A day belongs to exactly one window.
 *
 * Both are expressed as half-open intervals [start, end): `start` is
 * inclusive, `end` is exclusive. The backend's `revenueByDay` series is
 * inclusive of the last day, so the HTTP request built from a window uses
 * `end - 1 day` as its `to` parameter — that is the only place the
 * half-open interval is converted, and it is done in one function so the
 * request and the label can never disagree.
 *
 * Everything here is pure and clock-injectable: `now` is a parameter, never
 * `Date.now()`, so the tests are deterministic.
 */

export interface PeriodWindow {
  /** Inclusive first day of the window. */
  start: Date;
  /** Exclusive end of the window (start of the next day). */
  end: Date;
  /** Number of whole days in the window. */
  days: number;
}

export interface PeriodRequest {
  /** `from` parameter for the API: inclusive ISO date (YYYY-MM-DD). */
  from: string;
  /** `to` parameter for the API: inclusive ISO date (YYYY-MM-DD). */
  to: string;
}

/**
 * Calendar-day arithmetic.
 *
 * NOT `getTime() + n * 24 * 60 * 60 * 1000`: a DST transition makes a
 * "day" 23 or 25 hours long, and adding 24h repeatedly drifts the window
 * off the calendar (a 90-day window would end on the 91st). `setDate` walks
 * the calendar, so every window is exactly N calendar days.
 */
function startOfDay(d: Date): Date {
  const copy = new Date(d.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The current window: the last `days` calendar days, ending today.
 *
 * `days = 30` and today = 2026-10-20 gives [2026-09-21, 2026-10-21) — that
 * is 30 days, not 31. The naive `now - days * 24h` produced a 31-day window
 * whose start (Sep 20) was also the previous window's end.
 */
export function currentPeriod(days: number, now: Date = new Date()): PeriodWindow {
  const end = addDays(startOfDay(now), 1); // exclusive: midnight after today
  const start = addDays(end, -days);
  return { start, end, days };
}

/**
 * The window immediately before the current one, with the same length.
 *
 * It ends exactly where the current window starts, so the two never overlap.
 */
export function previousPeriod(days: number, now: Date = new Date()): PeriodWindow {
  const current = currentPeriod(days, now);
  const end = current.start;
  const start = addDays(end, -days);
  return { start, end, days };
}

/**
 * HTTP query for a window. The API takes inclusive `from`/`to` dates, so the
 * exclusive `end` is converted to the last day of the window.
 */
export function periodRequest(window: PeriodWindow): PeriodRequest {
  const lastDay = addDays(window.end, -1);
  return { from: toIsoDate(window.start), to: toIsoDate(lastDay) };
}

/** Both windows in one object — the shape the service and the UI both need. */
export function periodPair(days: number, now: Date = new Date()): {
  current: PeriodWindow;
  previous: PeriodWindow;
} {
  return { current: currentPeriod(days, now), previous: previousPeriod(days, now) };
}
