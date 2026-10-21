import { currentPeriod, periodRequest, previousPeriod, type PeriodRequest } from './period';

/**
 * How the dashboard fetches the current window and the window before it.
 *
 * WHY THIS EXISTS
 * ---------------
 * `GET /api/dashboard/stats/overview/compare?days=N` returns a `previous`
 * object, and that object is NOT the previous period. Server-side,
 * `DashboardService.buildOverview(since, until, days)` accepts an `until`
 * bound and then never uses it — every query filters only
 * `o.createdAt >= :since`. For the previous period the server passes
 * `since = now - 2N days` and `until = now - N days`, but the `until` is
 * dropped, so the "previous" figure is actually "everything since 2N days
 * ago", which CONTAINS the current period. With the current seed (every
 * order on one day) that makes previous === current, and four KPIs showed a
 * flat 0.0% against a real previous period of zero.
 *
 * The backend cannot be changed here, so the client derives the previous
 * period itself from the ONE endpoint that is range-correct by construction:
 *
 *   GET /api/dashboard/stats/overview?days=K   ->  SUM/COUNT over [now-K, now]
 *
 * Because that aggregate is a plain sum over a lower bound, the value for the
 * window [now-2N, now-N) is exactly  value(2N) - value(N). The client issues
 * the wider request and subtracts.
 *
 * The two requests therefore cover DIFFERENT date ranges, and the dates each
 * one is credited with are explicit and disjoint — see `fetchPlan` and its
 * unit test.
 */

export interface PeriodFetchPlan {
  /** The `days` query parameter to send. */
  days: number;
  /** Inclusive ISO date the fetched data is credited to, as the first day. */
  from: string;
  /** Inclusive ISO date the fetched data is credited to, as the last day. */
  to: string;
}

export interface FetchPlan {
  current: PeriodFetchPlan;
  previous: PeriodFetchPlan;
}

/**
 * The two requests the dashboard makes, with the dates each one is
 * attributed to.
 *
 * - current : `days = N`      -> the current window,  [today-N+1 .. today]
 * - previous: `days = 2N`     -> the SPAN of both windows; the previous
 *                                window, [today-2N+1 .. today-N], is obtained
 *                                by subtracting the current window from it.
 *
 * The two plans never share a date: `previous.to` is strictly before
 * `current.from`, and the requests carry different `days` values, so the
 * previous period is never re-read as the current one.
 */
export function fetchPlan(days: number, now: Date = new Date()): FetchPlan {
  const current = currentPeriod(days, now);
  const previous = previousPeriod(days, now);

  const currentReq: PeriodRequest = periodRequest(current);
  const previousReq: PeriodRequest = periodRequest(previous);

  return {
    current: { days, from: currentReq.from, to: currentReq.to },
    previous: { days: days * 2, from: previousReq.from, to: previousReq.to },
  };
}

/**
 * The previous window's value, derived from the wider request.
 *
 * `span` is the aggregate over the 2N-day span, `current` the aggregate over
 * the current window. Their difference is the previous window — provided the
 * aggregate is additive, which every one of these is (SUM of order totals,
 * COUNT of orders, SUM of grams).
 */
export function previousValue(span: number, current: number): number {
  const diff = span - current;
  // Floating point noise around an exact zero would otherwise show up as
  // "-0.0000001" and produce a nonsense delta.
  return Math.abs(diff) < 1e-9 ? 0 : diff;
}
