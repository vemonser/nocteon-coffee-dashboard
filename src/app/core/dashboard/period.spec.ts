import { describe, expect, it } from 'vitest';
import {
  currentPeriod,
  periodPair,
  periodRequest,
  previousPeriod,
} from './period';

const NOW = new Date(2026, 9, 20, 13, 30); // 2026-10-20 13:30 local

const iso = (d: Date) =>
  `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;

describe('currentPeriod', () => {
  it('covers exactly `days` calendar days ending today', () => {
    const w = currentPeriod(30, NOW);
    expect(w.days).toBe(30);
    expect(iso(w.start)).toBe('2026-09-21');
    // end is exclusive: the midnight AFTER the last included day
    expect(iso(w.end)).toBe('2026-10-21');
  });

  it('is 30 days, not 31 — the old `now - 30*24h` over-counted by one', () => {
    const w = currentPeriod(30, NOW);
    const span = Math.round((w.end.getTime() - w.start.getTime()) / 86400000);
    expect(span).toBe(30);
  });

  it('is unaffected by the time of day', () => {
    const morning = currentPeriod(30, new Date(2026, 9, 20, 0, 1));
    const night = currentPeriod(30, new Date(2026, 9, 20, 23, 59));
    expect(iso(morning.start)).toBe(iso(night.start));
    expect(iso(morning.end)).toBe(iso(night.end));
  });

  it('handles a 7-day window', () => {
    const w = currentPeriod(7, NOW);
    expect(iso(w.start)).toBe('2026-10-14');
    expect(iso(w.end)).toBe('2026-10-21');
  });
});

describe('previousPeriod', () => {
  it('ends exactly where the current window starts — no overlap', () => {
    const { current, previous } = periodPair(30, NOW);
    expect(previous.end.getTime()).toBe(current.start.getTime());
  });

  it('has the same number of days as the current window', () => {
    for (const days of [7, 30, 90, 365]) {
      const { current, previous } = periodPair(days, NOW);
      expect(previous.days).toBe(days);
      const span = Math.round((previous.end.getTime() - previous.start.getTime()) / 86400000);
      expect(span).toBe(days);
    }
  });

  it('does not contain any day that the current window contains', () => {
    const { current, previous } = periodPair(30, NOW);
    const currentDays = new Set<string>();
    for (let d = new Date(current.start); d < current.end; d = new Date(d.getTime() + 86400000)) {
      currentDays.add(iso(d));
    }
    for (let d = new Date(previous.start); d < previous.end; d = new Date(d.getTime() + 86400000)) {
      expect(currentDays.has(iso(d))).toBe(false);
    }
  });

  it('covers the days immediately before the current window', () => {
    const w = previousPeriod(30, NOW);
    expect(iso(w.start)).toBe('2026-08-22');
    expect(iso(w.end)).toBe('2026-09-21');
  });
});

describe('periodRequest', () => {
  it('sends inclusive from/to dates that differ from the current window', () => {
    const { current, previous } = periodPair(30, NOW);
    const currentReq = periodRequest(current);
    const previousReq = periodRequest(previous);

    expect(currentReq.from).toBe('2026-09-21');
    expect(currentReq.to).toBe('2026-10-20');
    expect(previousReq.from).toBe('2026-08-22');
    expect(previousReq.to).toBe('2026-09-20');
  });

  it('produces different dates for the two windows (the comparison proof)', () => {
    for (const days of [7, 30, 90, 365]) {
      const { current, previous } = periodPair(days, NOW);
      const c = periodRequest(current);
      const p = periodRequest(previous);
      expect(p.from).not.toBe(c.from);
      expect(p.to).not.toBe(c.to);
      // the previous window must end before the current one starts
      expect(p.to < c.from).toBe(true);
    }
  });

  it('keeps the same number of days in both requests', () => {
    const { current, previous } = periodPair(30, NOW);
    const c = periodRequest(current);
    const p = periodRequest(previous);
    const daysBetween = (a: string, b: string) =>
      Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
    expect(daysBetween(c.from, c.to)).toBe(30);
    expect(daysBetween(p.from, p.to)).toBe(30);
  });
});

/**
 * The day boundary.
 *
 * The store runs in Africa/Cairo (EEST, UTC+3 in October) and the windows
 * are CALENDAR days in that zone. The database, however, buckets a day with
 * `CAST(createdAt AS date)` in UTC, and the `since` bound is an instant. So
 * an order placed between 00:00 and 03:00 Cairo lands on the PREVIOUS day
 * in the backend's daily series.
 *
 * These tests pin the behaviour the dashboard can rely on: the window is
 * half-open, it is a set of whole local days, and an order at 23:30 is
 * unambiguously inside or outside it.
 */
describe('day boundary', () => {
  const at = (y: number, m: number, d: number, hh: number, mm: number) =>
    new Date(y, m - 1, d, hh, mm, 0, 0);

  it('an order at 23:30 on the last day of the window is inside it', () => {
    const now = at(2026, 10, 20, 12, 0);
    const window = currentPeriod(30, now);
    const order = at(2026, 10, 20, 23, 30);
    expect(order.getTime()).toBeGreaterThanOrEqual(window.start.getTime());
    expect(order.getTime()).toBeLessThan(window.end.getTime());
  });

  it('an order at 23:30 on the day BEFORE the window is outside it', () => {
    const now = at(2026, 10, 20, 12, 0);
    const window = currentPeriod(30, now);
    const order = at(2026, 9, 20, 23, 30); // the day before the window starts
    expect(order.getTime()).toBeLessThan(window.start.getTime());
  });

  it('an order at 00:30 on the FIRST day of the window is inside it', () => {
    const now = at(2026, 10, 20, 12, 0);
    const window = currentPeriod(30, now);
    const order = at(2026, 9, 21, 0, 30);
    expect(order.getTime()).toBeGreaterThanOrEqual(window.start.getTime());
    expect(order.getTime()).toBeLessThan(window.end.getTime());
  });

  it('the window is a set of whole local days, from midnight to midnight', () => {
    const now = at(2026, 10, 20, 12, 0);
    const window = currentPeriod(30, now);
    expect(window.start.getHours()).toBe(0);
    expect(window.start.getMinutes()).toBe(0);
    // The end is EXCLUSIVE: the midnight after the last included day.
    expect(window.end.getHours()).toBe(0);
    expect(window.end.getDate()).toBe(21);
  });

  it('the window does not move with the time of day', () => {
    const morning = currentPeriod(30, at(2026, 10, 20, 0, 5));
    const night = currentPeriod(30, at(2026, 10, 20, 23, 55));
    expect(morning.start.getTime()).toBe(night.start.getTime());
    expect(morning.end.getTime()).toBe(night.end.getTime());
  });
});
