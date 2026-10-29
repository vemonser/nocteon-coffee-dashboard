import { describe, expect, it } from 'vitest';
import {
  EXPORT_COUNT_BASE,
  exportCount,
  exportCountKey,
  exportCountLabel,
} from './export-count-label';
import { pluralCategory } from '../../../core/i18n/plural';

type Dict = Record<string, unknown>;

/**
 * The REAL locale files, so the spec fails when a plural category is added
 * to one side only or a wording regresses — not when a stub drifts.
 */
const localeModules = import.meta.glob('/public/assets/i18n/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Dict>;

const en = localeModules['/public/assets/i18n/en.json'];
const ar = localeModules['/public/assets/i18n/ar.json'];

/** Transloco's `translate(key, params)`: `{{count}}` interpolation, key on a miss. */
function translateWith(dict: Dict) {
  return (key: string, params: Record<string, unknown> = {}): string => {
    const value = key
      .split('.')
      .reduce<unknown>((node, part) => (node as Dict)?.[part], dict);
    if (typeof value !== 'string') return key;
    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => String(params[name] ?? ''));
  };
}

const label = (count: number, lang: 'en' | 'ar'): string =>
  exportCountLabel(count, lang, translateWith(lang === 'en' ? en : ar));

describe('exportCount', () => {
  it('never returns a value a label would print as NaN or negative', () => {
    expect(exportCount(Number.NaN)).toBe(0);
    expect(exportCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(exportCount(-3)).toBe(0);
    expect(exportCount(12.9)).toBe(12);
    expect(exportCount(0)).toBe(0);
    expect(exportCount(128)).toBe(128);
  });
});

describe('exportCountKey', () => {
  it('maps English counts to the one/other family', () => {
    expect(exportCountKey(0, 'en')).toBe(`${EXPORT_COUNT_BASE}_other`);
    expect(exportCountKey(1, 'en')).toBe(`${EXPORT_COUNT_BASE}_one`);
    expect(exportCountKey(2, 'en')).toBe(`${EXPORT_COUNT_BASE}_other`);
    expect(exportCountKey(100, 'en')).toBe(`${EXPORT_COUNT_BASE}_other`);
  });

  it('maps Arabic counts to all six Intl.PluralRules categories', () => {
    expect(exportCountKey(0, 'ar')).toBe(`${EXPORT_COUNT_BASE}_zero`);
    expect(exportCountKey(1, 'ar')).toBe(`${EXPORT_COUNT_BASE}_one`);
    expect(exportCountKey(2, 'ar')).toBe(`${EXPORT_COUNT_BASE}_two`);
    expect(exportCountKey(3, 'ar')).toBe(`${EXPORT_COUNT_BASE}_few`);
    expect(exportCountKey(11, 'ar')).toBe(`${EXPORT_COUNT_BASE}_many`);
    expect(exportCountKey(100, 'ar')).toBe(`${EXPORT_COUNT_BASE}_other`);
    // Three-digit counts follow the last two digits, like the header count.
    expect(exportCountKey(101, 'ar')).toBe(`${EXPORT_COUNT_BASE}_other`);
    expect(exportCountKey(103, 'ar')).toBe(`${EXPORT_COUNT_BASE}_few`);
  });

  it('clamps a malformed total before it selects a category', () => {
    expect(exportCountKey(Number.NaN, 'ar')).toBe(`${EXPORT_COUNT_BASE}_zero`);
    expect(exportCountKey(-1, 'ar')).toBe(`${EXPORT_COUNT_BASE}_zero`);
  });
});

describe('exportCountLabel', () => {
  it('states the count in English', () => {
    expect(label(0, 'en')).toBe('Export 0 orders');
    expect(label(1, 'en')).toBe('Export 1 order');
    expect(label(2, 'en')).toBe('Export 2 orders');
    expect(label(3, 'en')).toBe('Export 3 orders');
    expect(label(11, 'en')).toBe('Export 11 orders');
    expect(label(100, 'en')).toBe('Export 100 orders');
  });

  it('states the count in Arabic, in the grammar of the number', () => {
    // 0, 1 and 2 are said with words; from 3 up the digit is in the sentence.
    expect(label(0, 'ar')).toBe('لا طلبات للتصدير');
    expect(label(1, 'ar')).toBe('تصدير طلب واحد');
    expect(label(2, 'ar')).toBe('تصدير طلبين');
    expect(label(3, 'ar')).toBe('تصدير 3 طلبات');
    expect(label(11, 'ar')).toBe('تصدير 11 طلبًا');
    expect(label(100, 'ar')).toBe('تصدير 100 طلب');
    expect(label(103, 'ar')).toBe('تصدير 103 طلبات');
  });

  it('prints the number for every count of 3 and above in both locales', () => {
    // "The button states the row count": from 3 up the digit is visible.
    const missing: string[] = [];
    for (const count of [3, 4, 10, 11, 99, 100, 101, 128, 1234]) {
      for (const lang of ['en', 'ar'] as const) {
        if (!label(count, lang).includes(String(count))) {
          missing.push(`${lang}:${count} → "${label(count, lang)}"`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('never shows a raw key, a placeholder or NaN', () => {
    const bad: string[] = [];
    const counts = [0, 1, 2, 3, 11, 100, 1234];
    for (const count of counts) {
      for (const lang of ['en', 'ar'] as const) {
        const text = label(count, lang);
        if (text.includes(EXPORT_COUNT_BASE) || text.includes('{{') || /NaN|undefined|null/.test(text)) {
          bad.push(`${lang}:${count} → "${text}"`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('falls back to `_other`, then to the number, instead of a key', () => {
    // A category missing from a locale: `_other` answers.
    const onlyOther = { orders: { export: { count_other: 'Export {{count}} orders' } } };
    expect(exportCountLabel(11, 'ar', translateWith(onlyOther))).toBe('Export 11 orders');
    // Nothing at all: the number, never `orders.export.count_many`.
    const empty = {};
    expect(exportCountLabel(11, 'ar', translateWith(empty))).toBe('11');
  });
});

describe('the export label family in the locale files', () => {
  it('defines every category each language selects', () => {
    const expected: Array<[string, string]> = [
      ['en', 'one'],
      ['en', 'other'],
      ['ar', 'zero'],
      ['ar', 'one'],
      ['ar', 'two'],
      ['ar', 'few'],
      ['ar', 'many'],
      ['ar', 'other'],
    ];
    const missing = expected
      .filter(([lang, category]) => {
        const translate = translateWith(lang === 'en' ? en : ar);
        const key = `${EXPORT_COUNT_BASE}_${category}`;
        return translate(key) === key;
      })
      .map(([lang, category]) => `${lang}:${EXPORT_COUNT_BASE}_${category}`);
    expect(missing).toEqual([]);
  });

  it('covers every category Intl.PluralRules can select for 0..1200', () => {
    const missing = new Set<string>();
    for (const lang of ['en', 'ar'] as const) {
      const translate = translateWith(lang === 'en' ? en : ar);
      for (let count = 0; count <= 1200; count++) {
        const category = pluralCategory(count, lang);
        const key = `${EXPORT_COUNT_BASE}_${category}`;
        if (translate(key) === key) missing.add(`${lang}:${key}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
