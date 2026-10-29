import { describe, expect, it } from 'vitest';
import { formatCompactCurrency, formatCurrency, formatDate, formatDateTime, formatRating } from './locale-format';

/**
 * Phase 1, ticket 1.3 — ONE money formatter.
 *
 * The QA report found money formatted three different ways in the same app:
 *   - `E£` in the KPIs, `$` in Recent Orders, `US$` on a product card
 *   - a `| number:'1.2-2'` pipe (no currency at all) on the promo-codes card
 *   - a hardcoded `$` prefix on the Top Selling Products card
 *
 * This test is the guard: every money value in a template must go through the
 * shared formatter, and the formatter must be the only place a currency is
 * rendered.
 *
 * It scans the source tree, so it fails the moment a template grows a second
 * way of printing money.
 */

const templates = import.meta.glob('/src/app/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const sources = import.meta.glob('/src/app/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('money formatter', () => {
  it('renders EGP with the ISO code in English and the Arabic symbol in Arabic', () => {
    // The English form is the CODE first ("EGP 1,176.25"): the CLDR narrow
    // symbol ("E£") is a currency symbol in a Latin shape, so the reader saw
    // two different-looking currencies depending on the page.
    expect(formatCurrency(1176.25, 'en', 'EGP')).toContain('EGP');
    expect(formatCurrency(1176.25, 'en', 'EGP')).not.toContain('E£');
    // The Arabic form is the AMOUNT first, then the Arabic symbol, with no
    // trailing full stop ("1,176.25 ج.م").
    expect(formatCurrency(1176.25, 'ar', 'EGP')).toContain('ج.م');
    expect(formatCurrency(1176.25, 'ar', 'EGP')).not.toContain('ج.م.');
  });

  it('keeps Latin digits in Arabic', () => {
    const ar = formatCurrency(1176.25, 'ar', 'EGP');
    expect(ar).toMatch(/1,176\.25/);
    expect(ar).not.toMatch(/[٠-٩]/);
  });

  it('never emits the raw Latin "E£" inside the Arabic locale', () => {
    expect(formatCurrency(1176.25, 'ar', 'EGP')).not.toContain('E£');
  });

  it('is the only currency renderer: no template hardcodes a currency symbol', () => {
    const offenders: string[] = [];
    for (const [file, text] of Object.entries(templates)) {
      // A bare "$" next to a number, or a currency code in front of a value.
      const patterns = [/\$[\s{]*[0-9{]/, /US\$/, /\bEGP[\s{]*[0-9{]/, /\bUSD[\s{]*[0-9{]/];
      for (const re of patterns) {
        if (re.test(text)) {
          offenders.push(`${file}: ${re}`);
        }
      }
    }
    expect(offenders, `hardcoded currency found:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no template uses the built-in currency pipe (it hardcodes the code)', () => {
    const offenders: string[] = [];
    for (const [file, text] of Object.entries(templates)) {
      if (/\|\s*currency\b/.test(text)) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `built-in | currency pipe used — it hardcodes the currency code instead of reading the store setting:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('no source file imports Angular\'s CurrencyPipe', () => {
    const offenders: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      if (/import\s*\{[^}]*CurrencyPipe/.test(text)) {
        offenders.push(file);
      }
    }
    expect(
      offenders,
      `CurrencyPipe imported — use the shared | money pipe:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('no template prints money with the bare number pipe', () => {
    const offenders: string[] = [];
    // Money-looking field names piped through | number with a decimal format.
    const moneyField = /(amount|price|revenue|total|discount|subtotal|balance|value)/i;
    for (const [file, text] of Object.entries(templates)) {
      const pipe = /([A-Za-z0-9_.\[\]'"]+)\s*\|\s*number\s*:\s*'([0-9.]+-)?[0-9.]+'/g;
      let m: RegExpExecArray | null;
      while ((m = pipe.exec(text))) {
        if (moneyField.test(m[1])) {
          offenders.push(`${file}: ${m[0].trim()}`);
        }
      }
    }
    expect(
      offenders,
      `money printed with the number pipe instead of | money:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('no source file formats money with toFixed', () => {
    const offenders: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      const lines = text.split('\n');
      lines.forEach((line: string, i: number) => {
        if (/toFixed\(/.test(line) && /(price|amount|revenue|total|money|currency)/i.test(line)) {
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `money formatted with toFixed instead of the shared formatter:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('has no default currency, so the compiler forces every call to pass one', () => {
    const source = sources['/src/app/shared/utils/locale-format.ts'] ?? '';
    const signature = source.slice(source.indexOf('export function formatCurrency('));
    expect(signature).toMatch(/currency:\s*string\s*,/);
    expect(signature).not.toMatch(/currency\s*=\s*['"]/);
  });
});

/**
 * The compact money — the chart axes and the donut centres.
 *
 * It follows the SAME order as the full form: the code first in English,
 * the amount first in Arabic. An axis and a card must never disagree
 * about which side the unit is on.
 */
describe('the compact money', () => {
  it('is the code first in English', () => {
    expect(formatCompactCurrency(1200, 'en', 'EGP')).toBe('EGP 1.2K');
  });

  it('is the amount first in Arabic, with the symbol and no trailing dot', () => {
    const ar = formatCompactCurrency(1200, 'ar', 'EGP');
    expect(ar).toBe('1.2K ج.م');
    expect(ar).not.toContain('ج.م.');
  });

  it('keeps the compact suffixes in both languages', () => {
    expect(formatCompactCurrency(1_500_000, 'en', 'EGP')).toBe('EGP 1.5M');
    expect(formatCompactCurrency(999, 'en', 'EGP')).toBe('EGP 999');
  });

  it('falls back to the code when a currency has no Arabic symbol', () => {
    expect(formatCompactCurrency(1200, 'ar', 'XYZ')).toContain('XYZ');
  });
});

describe('date formatter', () => {
  it('formats en date', () => {
    expect(formatDate('2026-10-24', 'en')).toBe('24 Oct 2026');
  });
  it('formats en date+time with one comma', () => {
    const s = formatDateTime('2026-10-24T19:51:00', 'en');
    expect(s).toMatch(/^24 Oct 2026, \d{1,2}:\d{2} (AM|PM)$/);
    expect(s).not.toMatch(/\\s,/);
  });
  it('formats ar date', () => {
    expect(formatDate('2026-10-24', 'ar')).toContain('2026');
    expect(formatDate('2026-10-24', 'ar')).not.toMatch(/[٠-٩]/);
  });
});

describe('raw date format guard', () => {
  it('no template uses a raw date format pipe', () => {
    const offenders: string[] = [];
    for (const [file, text] of Object.entries(templates)) {
      if (/\|\s*date\b/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
  it('no source uses toLocaleString for dates', () => {
    const offenders: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      if (/toLocaleString|toLocaleDateString|toLocaleTimeString/.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * FE-14: a rating always shows ONE decimal, in both languages, with Latin
 * digits. "4" and "4.3" must not look alike, and the decimal point must not be
 * reordered inside an Arabic paragraph.
 */
describe('rating formatter', () => {
  it('keeps a single decimal in both languages', () => {
    expect(formatRating(4.3, 'en')).toMatch(/4\.3/);
    expect(formatRating(4, 'en')).toMatch(/4\.0/);
    expect(formatRating(5, 'ar')).toMatch(/5\.0/);
    expect(formatRating(4.3, 'ar')).toMatch(/4\.3/);
  });

  it('never emits Arabic-Indic digits or a null-ish value', () => {
    expect(formatRating(4.25, 'ar')).not.toMatch(/[٠-٩]/);
    // The API rounds; the cell still rounds to the same precision if it does not.
    expect(formatRating(4.25, 'en')).toMatch(/4\.3/);
    expect(formatRating(null, 'en')).toBe('');
    expect(formatRating(undefined, 'ar')).toBe('');
  });

  it('isolates the value so bidi cannot move the decimal point', () => {
    expect(formatRating(4.3, 'ar').startsWith('\u2066')).toBe(true);
    expect(formatRating(4.3, 'ar').endsWith('\u2069')).toBe(true);
  });
});

/**
 * The guard for the compact money: the axes and the centres must not
 * build their own labels.
 */
describe('the compact money is the only compact money', () => {
  it('no source file builds a compact amount with toFixed', () => {
    const offenders: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      const lines = text.split('\n');
      lines.forEach((line: string, i: number) => {
        if (
          /toFixed\(/.test(line) &&
          /(1_000|1000|compact|axis|1e6|1e3)/i.test(line) &&
          !file.includes('locale-format.ts')
        ) {
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `a compact amount built by hand instead of formatCompactCurrency:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
