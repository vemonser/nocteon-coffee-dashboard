import { describe, expect, it } from 'vitest';

import { endOfDayIso, startOfDayIso } from './audit-date-range';

/**
 * The audit page's two date boxes are `<input type="date">` — a LOCAL calendar
 * day — while the endpoint takes instants. These two helpers are the join, and
 * a wrong join moves a reader's day by the UTC offset (Cairo is +02/+03), so
 * the first hours of their morning would land in the previous day.
 */
describe('audit date range', () => {
  it('starts the day at local midnight', () => {
    expect(startOfDayIso('2026-03-02')).toBe(new Date(2026, 2, 2, 0, 0, 0, 0).toISOString());
  });

  it('ends the day at the last local millisecond', () => {
    expect(endOfDayIso('2026-03-02')).toBe(new Date(2026, 2, 2, 23, 59, 59, 999).toISOString());
  });

  it('reads an empty box as no bound', () => {
    expect(startOfDayIso('')).toBeUndefined();
    expect(startOfDayIso(null)).toBeUndefined();
    expect(endOfDayIso(undefined)).toBeUndefined();
  });

  it('rejects a half-typed or impossible date instead of sending it', () => {
    expect(startOfDayIso('2026-03')).toBeUndefined();
    expect(startOfDayIso('02/03/2026')).toBeUndefined();
    expect(startOfDayIso('2026-02-31')).toBeUndefined();
    expect(endOfDayIso('2026-13-01')).toBeUndefined();
  });

  it('keeps a real leap day', () => {
    expect(startOfDayIso('2028-02-29')).toBe(new Date(2028, 1, 29, 0, 0, 0, 0).toISOString());
  });
});
