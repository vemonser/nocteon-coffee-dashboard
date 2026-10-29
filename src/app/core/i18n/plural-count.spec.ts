import { describe, expect, it } from 'vitest';
import { countMessage } from './plural';

/**
 * A count becomes a sentence in ONE place.
 *
 * The `plural` pipe (templates) and `NotifyService.countText` (toast bodies)
 * both call `countMessage`, so "12 orders updated" cannot be worded one way
 * on screen and another way in a toast. The wording itself is asserted
 * against a fake dictionary here — the real families are covered by
 * `i18n-keys.spec.ts` (every family complete, in both locales).
 */

const DICT: Record<string, string> = {
  'x.items_one': 'one item',
  'x.items_other': 'many items',
  'x.items_zero': 'no items',
  'x.items_two': 'two items',
  'x.items_few': 'few items',
  'x.items_many': 'eleven items',
};

/** Stands in for Transloco: a miss returns the key, as Transloco does. */
const translate = (key: string): string => DICT[key] ?? key;

describe('countMessage', () => {
  it('uses the category the language selects — English', () => {
    expect(countMessage(translate, 'en', 'x.items', 1)).toBe('one item');
    expect(countMessage(translate, 'en', 'x.items', 7)).toBe('many items');
  });

  it('uses all six Arabic categories', () => {
    expect(countMessage(translate, 'ar', 'x.items', 0)).toBe('no items');
    expect(countMessage(translate, 'ar', 'x.items', 1)).toBe('one item');
    expect(countMessage(translate, 'ar', 'x.items', 2)).toBe('two items');
    expect(countMessage(translate, 'ar', 'x.items', 3)).toBe('few items');
    expect(countMessage(translate, 'ar', 'x.items', 11)).toBe('eleven items');
    expect(countMessage(translate, 'ar', 'x.items', 100)).toBe('many items');
  });

  it('passes the count to the message', () => {
    const seen: Array<Record<string, unknown> | undefined> = [];
    countMessage(
      (key, params) => {
        seen.push(params);
        return DICT[key] ?? key;
      },
      'en',
      'x.items',
      4,
      { total: 12 },
    );
    expect(seen[0]).toEqual({ count: 4, total: 12 });
  });

  it('falls back to _other, then to the bare number — never a raw key', () => {
    const onlyOther: Record<string, string> = { 'x.only_other': 'many' };
    const translateOnlyOther = (key: string): string => onlyOther[key] ?? key;
    expect(countMessage(translateOnlyOther, 'en', 'x.only', 1)).toBe('many');

    expect(countMessage(translate, 'en', 'x.missing', 5)).toBe('5');
  });
});
