import { describe, expect, it } from 'vitest';

import { formatRelativeTime } from './relative-time';

/**
 * The relative time is what a reader scans, so it must be short and in the
 * right language. The absolute value lives in the tooltip, not here.
 */
describe('formatRelativeTime', () => {
  it('says "Just now" for anything inside a minute', () => {
    const now = new Date().toISOString();

    expect(formatRelativeTime(now, 'en')).toBe('Just now');
    expect(formatRelativeTime(now, 'ar')).toBe('الآن');
  });

  it('counts the hours in English', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    expect(formatRelativeTime(twoHoursAgo, 'en')).toContain('2');
  });

  it('returns an empty string for a missing value', () => {
    expect(formatRelativeTime(null, 'en')).toBe('');
    expect(formatRelativeTime('not a date', 'en')).toBe('');
  });
});
