import { describe, expect, it } from 'vitest';
import { toLocalInputValue } from './date-input';

/**
 * FE-03: the schedule date must not move when a post is reopened.
 *
 * <p>`datetime-local` speaks local wall-clock time. Slicing an ISO string
 * (`.substring(0, 16)`) treats UTC as local and shifts the instant by the
 * browser's offset on every save, which can push a scheduled post across "now".
 */
describe('toLocalInputValue', () => {
  it('keeps the same instant when the input value is read back as local time', () => {
    const iso = '2026-10-29T12:33:00Z';
    const value = toLocalInputValue(iso);

    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(value).getTime()).toBe(new Date(iso).getTime());
  });

  it('handles a midnight instant without rolling the day', () => {
    const iso = '2026-10-29T00:00:00Z';
    const value = toLocalInputValue(iso);

    expect(new Date(value).getTime()).toBe(new Date(iso).getTime());
  });

  it('returns an empty field for null or unparseable values', () => {
    expect(toLocalInputValue(null)).toBe('');
    expect(toLocalInputValue(undefined)).toBe('');
    expect(toLocalInputValue('not-a-date')).toBe('');
  });
});
