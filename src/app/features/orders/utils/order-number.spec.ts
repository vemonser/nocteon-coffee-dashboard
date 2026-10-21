import { describe, expect, it } from 'vitest';
import { formatOrderNumber, isolatedOrderNumber } from './order-number';

/**
 * Phase 1, ticket 1.6 — ONE order-number formatter.
 *
 * The number belongs to the backend (`ORD-YYYY-NNNNNN`). The UI displays it;
 * it never re-formats it and never invents one.
 */
describe('formatOrderNumber', () => {
  it('shows the backend number as it is', () => {
    expect(formatOrderNumber('ORD-2026-000001')).toBe('ORD-2026-000001');
  });

  it('falls back to the id when an order has no number', () => {
    expect(formatOrderNumber(null, 42)).toBe('#42');
    expect(formatOrderNumber('', 42)).toBe('#42');
    expect(formatOrderNumber(undefined, 42)).toBe('#42');
  });

  it('never renders an empty cell', () => {
    expect(formatOrderNumber(null, null)).toBe('—');
    expect(formatOrderNumber(undefined, undefined)).toBe('—');
  });

  it('trims the value', () => {
    expect(formatOrderNumber('  ORD-2026-000001  ')).toBe('ORD-2026-000001');
  });
});

describe('isolatedOrderNumber', () => {
  it('wraps the number in a left-to-right isolate', () => {
    expect(isolatedOrderNumber('ORD-2026-000001')).toBe('\u2066ORD-2026-000001\u2069');
  });

  it('isolates the id fallback too', () => {
    expect(isolatedOrderNumber(null, 7)).toBe('\u2066#7\u2069');
  });
});
