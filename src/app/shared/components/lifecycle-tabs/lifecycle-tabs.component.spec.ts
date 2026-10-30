import { describe, expect, it } from 'vitest';
import { formatCountBadge } from './lifecycle-tabs.component';

/**
 * The tab badges are the only count a reader sees before opening a tab, so
 * they must report the real total. The old cap was 9 ("9+"), which turned a
 * 15-item trash into "9+" — every count above nine under-reported.
 */
describe('lifecycle tabs count badge', () => {
  const tabs = { displayCount: formatCountBadge };

  it('shows the exact count up to 99', () => {
    expect(tabs.displayCount(0)).toBe('0');
    expect(tabs.displayCount(9)).toBe('9');
    expect(tabs.displayCount(15)).toBe('15');
    expect(tabs.displayCount(99)).toBe('99');
  });

  it('caps above 99 so the badge stays one short token', () => {
    expect(tabs.displayCount(100)).toBe('99+');
    expect(tabs.displayCount(1500)).toBe('99+');
  });

  it('uses an em dash while the count has not loaded', () => {
    expect(tabs.displayCount(null)).toBe('—');
  });
});
