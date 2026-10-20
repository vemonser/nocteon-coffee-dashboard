import { describe, expect, it } from 'vitest';
import { fetchPlan, previousValue } from './period-fetch';

const NOW = new Date(2026, 9, 20, 13, 30); // 2026-10-20 13:30 local

describe('fetchPlan', () => {
  it('sends different `days` for the current and the previous request', () => {
    const plan = fetchPlan(30, NOW);
    expect(plan.current.days).toBe(30);
    expect(plan.previous.days).toBe(60);
    expect(plan.previous.days).not.toBe(plan.current.days);
  });

  it('credits the two requests with different date ranges', () => {
    const plan = fetchPlan(30, NOW);
    expect(plan.current.from).toBe('2026-09-21');
    expect(plan.current.to).toBe('2026-10-20');
    expect(plan.previous.from).toBe('2026-08-22');
    expect(plan.previous.to).toBe('2026-09-20');
  });

  it('the previous range ends strictly before the current range starts', () => {
    for (const days of [7, 30, 90, 365]) {
      const plan = fetchPlan(days, NOW);
      expect(plan.previous.to < plan.current.from).toBe(true);
      expect(plan.previous.from).not.toBe(plan.current.from);
      expect(plan.previous.to).not.toBe(plan.current.to);
    }
  });

  it('the wider request covers the union of both windows', () => {
    const plan = fetchPlan(30, NOW);
    // 60 days back from 2026-10-20 inclusive -> 2026-08-22
    expect(plan.previous.from).toBe('2026-08-22');
    expect(plan.current.to).toBe('2026-10-20');
  });

  it('each window is exactly `days` long', () => {
    for (const days of [7, 30, 90, 365]) {
      const plan = fetchPlan(days, NOW);
      // Parse as LOCAL dates: the period module works in calendar days, and
      // `new Date('YYYY-MM-DD')` would parse as UTC midnight.
      const local = (iso: string) => {
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).getTime();
      };
      const span = (a: string, b: string) =>
        Math.round((local(b) - local(a)) / 86400000) + 1;
      expect(span(plan.current.from, plan.current.to)).toBe(days);
      expect(span(plan.previous.from, plan.previous.to)).toBe(days);
    }
  });
});

describe('previousValue', () => {
  it('derives the previous window from the wider request minus the current one', () => {
    // 60-day span holds both windows; the current window holds 1176.25.
    expect(previousValue(1176.25, 1176.25)).toBe(0);
    expect(previousValue(2000, 1176.25)).toBe(823.75);
  });

  it('returns exactly zero rather than floating point noise', () => {
    expect(previousValue(0.1 + 0.2, 0.3)).toBe(0);
  });

  it('never returns a negative zero', () => {
    expect(Object.is(previousValue(5, 5), -0)).toBe(false);
  });
});
