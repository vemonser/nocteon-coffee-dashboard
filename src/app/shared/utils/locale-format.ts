import type { Language } from '../../core/i18n/language';

/**
 * Phase 1: every user-facing date/number goes through Intl with the active
 * locale. User decision (recorded): Arabic mode uses LATIN digits
 * (`ar-EG-u-nu-latn`), applied consistently to dates, prices and counts.
 *
 * Bidi: formatted values are wrapped in FSI/PDI isolates (U+2066..U+2069) so
 * neutral characters (%, commas, hyphens, $) render correctly inside RTL
 * text. Isolates are inert in LTR.
 *
 * CURRENCY (Phase 1, ticket 1.3; ROUND 2, ticket 1.5)
 * --------------------------------------------------
 * There is exactly ONE money formatter in the app: `formatCurrency`. It is
 * fed by the store currency setting (`GET /api/settings` -> `currency`) and
 * used by KPIs, charts, tables, tooltips and the CSV export.
 *
 * The currency DISPLAY is defined ONCE, here, in both languages:
 *
 *   - English  -> the ISO CODE first, then the amount: "EGP 1,176.25"
 *   - Arabic   -> the amount first, then the ARABIC symbol: "1,176.25 ج.م"
 *
 * Two rules that the earlier version got wrong:
 *
 *  1. The English form used the CLDR narrow symbol, which renders as the
 *     Latin "E£" — a currency SYMBOL in a Latin shape, so the reader sees
 *     two different-looking currencies depending on the page ("E£" on the
 *     dashboard, "EGP" on the Orders page). The CODE is the same in every
 *     language and every surface.
 *  2. The Arabic form was wrapped in a LEFT-TO-RIGHT ISOLATE (U+2066),
 *     which forced the amount to the LEFT of the symbol — the reader then
 *     read the symbol first. The Arabic money is NOT isolated: the
 *     paragraph direction places the amount first (rightmost in RTL), which
 *     is the order a reader expects.
 *
 * The Arabic symbol is written WITHOUT its trailing dot ("ج.م", not
 * "ج.م."): the dot is a sentence terminator in the CLDR string, and an
 * amount is not a sentence.
 *
 * The compact form (chart axes, donut centres) is `formatCompactCurrency`,
 * and it follows the SAME order as the full form: "EGP 1.2K" / "1.2K ج.م".
 */

export function appLocale(lang: Language): string {
  return lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
}

/** Plural-rule locale (digit choice does not affect category selection). */
function pluralLocale(lang: Language): string {
  return lang === 'ar' ? 'ar-EG' : 'en-US';
}

/** Strip directional marks — callers always wrap output in an LRI..PDI
 * isolate, where embedded RLM/LRM marks only shuffle neutrals. */
function clean(s: string): string {
  return s.replace(/[\u200e\u200f]/g, '');
}

/**
 * `${base}_${Intl.PluralRules category}` — e.g. `subtitleActive_few`.
 * Callers define one key per reachable category (EN: one/other, AR: all six).
 */
export function pluralKey(base: string, count: number, lang: Language): string {
  return `${base}_${new Intl.PluralRules(pluralLocale(lang)).select(count)}`;
}

/**
 * Date as day/month/year parts for <app-localized-date>, which lays them out
 * in DOM order (flex row) in BOTH languages. Proven necessary: "13" + Arabic
 * month + "2026" as plain text can NOT render day-first in any paragraph
 * direction (bidi law — verified in browser lab). Parts carry no isolates
 * or marks.
 */
export interface DateParts {
  day: string;
  month: string;
  year: string;
}

export function dateParts(
  value: unknown,
  lang: Language,
  monthStyle: 'short' | 'long' = 'short',
): DateParts | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  // Explicit fields (not dateStyle): ar medium is numeric-only, while EN
  // medium is month-first — fields keep the content equivalent; the ORDER
  // is fixed day-month-year (not locale order). Tables use short months
  // ("13 Oct 2026"); detail pages use long ("13 October 2026"). No commas —
  // day-month-year order never takes one.
  const dtf = new Intl.DateTimeFormat(appLocale(lang), {
    day: 'numeric',
    month: monthStyle,
    year: 'numeric',
  });
  const pick = (type: string): string =>
    clean(dtf.formatToParts(d).find((p) => p.type === type)?.value ?? '');
  return { day: pick('day'), month: pick('month'), year: pick('year') };
}

/**
 * Absolute date + time as ONE string, for the `<time>` tooltip and its
 * screen-reader text (design.md §4). The rest of the app never stringifies a
 * date — it lays the parts out as DOM-ordered spans, because bidi reorders a
 * single string. A `title` attribute cannot hold DOM, so this is the one place
 * a date is flattened; `datetime` on the same element carries the
 * reorder-proof value, so nothing depends on reading this string.
 */
export function formatDateTime(value: unknown, lang: Language): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return clean(
    new Intl.DateTimeFormat(appLocale(lang), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d),
  );
}

/**
 * The time of day, on its own.
 *
 * The same rules as the date: the locale decides the 12/24-hour form, the
 * digits stay Latin in Arabic, and the value is wrapped in an isolate so a
 * neutral character (the colon) cannot be reordered inside an RTL
 * paragraph. "2:30 PM" is a Latin run; without the isolate the "PM" can end
 * up on the wrong side of the digits.
 */
export function formatTime(value: unknown, lang: Language): string {
  if (value === null || value === undefined || value === '') return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const s = clean(
    new Intl.DateTimeFormat(appLocale(lang), {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d),
  );
  return `\u2066${s}\u2069`;
}

/**
 * The date AND the time as one string — the absolute value behind a
 * `<time datetime="…">`, for a tooltip or a `title` attribute.
 */
export function formatDateAndTime(value: unknown, lang: Language): string {
  const parts = dateParts(value, lang, 'short');
  if (!parts) return '';
  const time = formatTime(value, lang).replace(/[\u2066\u2069]/g, '');
  const date = `${parts.day} ${parts.month} ${parts.year}`;
  return time ? `${date}, ${time}` : date;
}

/**
 * The currency code, normalised.
 *
 * The store setting is written by a form, so it can arrive as "egp" or with
 * a stray space. Intl needs three upper-case letters, and an unknown code
 * THROWS — so the code is normalised here, once, instead of at every call
 * site.
 */
export function normaliseCurrencyCode(currency: string): string {
  const code = (currency ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : 'USD';
}

/**
 * The currency's symbol in ARABIC, without the trailing dot.
 *
 * CLDR writes the Egyptian pound as "ج.م." — the dot is a full stop that
 * belongs to a sentence, not to an amount. `Intl` gives us the symbol as
 * one `currency` part, so the dot is trimmed here and NOWHERE else.
 *
 * A currency with no Arabic symbol (a code-only currency) falls back to
 * the ISO code, so the amount is never written without a unit.
 */
export function arabicCurrencySymbol(currency: string): string {
  let symbol = '';
  try {
    const parts = new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    }).formatToParts(1);
    symbol = parts.find((p) => p.type === 'currency')?.value ?? '';
  } catch {
    symbol = '';
  }
  symbol = clean(symbol).replace(/[.،]\s*$/, '').trim();
  return symbol || currency.toUpperCase();
}

/**
 * The one and only money formatter.
 *
 * English  -> "EGP 1,176.25"  (the ISO code, then the amount)
 * Arabic   -> "1,176.25 ج.م"  (the amount, then the Arabic symbol)
 *
 * The digits are Latin in BOTH languages, and the thousands/decimal
 * separators are the Latin ones in Arabic too, so a number never changes
 * shape when the language changes.
 */
export function formatCurrency(
  value: unknown,
  lang: Language,
  currency: string,
): string {
  const n =
    typeof value === 'number'
      ? value
      : Number.parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return String(value ?? '');

  const code = normaliseCurrencyCode(currency);

  if (lang === 'ar') {
    // The AMOUNT first, then the symbol. No LTR isolate: the isolate would
    // force the amount to the left of the symbol, so an Arabic reader read
    // the unit first.
    const amount = clean(
      new Intl.NumberFormat('ar-EG-u-nu-latn', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n),
    );
    return amount + ' ' + arabicCurrencySymbol(code);
  }

  // The CODE, not the symbol: the same unit on every page and in every
  // language. The narrow symbol rendered the Latin "E£" here.
  let s: string;
  try {
    s = clean(
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: code,
        currencyDisplay: 'code',
      }).format(n),
    );
  } catch {
    // An unknown code still has to print an amount.
    const amount = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
    s = amount + ' ' + code;
  }
  // Inert in an LTR paragraph, and it keeps the unit glued to the amount
  // when the paragraph is RTL.
  return `\u2066${s}\u2069`;
}

/**
 * The money WITHOUT the bidi isolate.
 *
 * A file is not a paragraph: the isolate characters would be written into
 * the CSV as invisible control characters. This is the same formatter, the
 * same rules, one wrapper less.
 */
export function formatCurrencyPlain(
  value: unknown,
  lang: Language,
  currency: string,
): string {
  return formatCurrency(value, lang, currency).replace(/[\u2066\u2069]/g, '');
}

/**
 * Compact money for chart axes and donut centres: "EGP 1.2K" / "1.2K ج.م".
 *
 * The SAME order as `formatCurrency` — the code first in English, the
 * amount first in Arabic — so an axis and a card never disagree about
 * which side the unit is on.
 */
export function formatCompactCurrency(
  value: unknown,
  lang: Language,
  currency: string,
): string {
  const compact = formatCompactNumber(value);
  if (!compact) return '';
  if (lang === 'ar') return compact + ' ' + arabicCurrencySymbol(normaliseCurrencyCode(currency));
  return normaliseCurrencyCode(currency) + ' ' + compact;
}

/**
 * Compact money for chart axes: "1.2K", "3.4M". No decimals below 1000 and
 * never a ".00" tail. Identical in both languages — the suffixes are ASCII
 * so the axis reads the same in EN and AR.
 */
export function formatCompactNumber(value: unknown): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** API gives "13" (or "13%") — defensive either way. */
export function formatPercent(value: unknown, lang: Language): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace('%', '').trim());
  if (!Number.isFinite(n)) return `\u2066${String(value ?? '')}\u2069`;
  const digits = clean(new Intl.NumberFormat(appLocale(lang), { maximumFractionDigits: 2 }).format(n));
  return `\u2066-${digits}%\u2069`;
}

/**
 * A signed percentage for a delta: "+12.5%" / "-3.0%".
 *
 * `signDisplay: 'always'` keeps the sign attached to the number so the bidi
 * algorithm cannot move it to the other side of the digits in an RTL
 * paragraph (the "0.0%+" defect). The caller wraps the result in <bdi>.
 */
export function formatSignedPercent(percent: number, lang: Language): string {
  if (!Number.isFinite(percent)) return '';
  const s = clean(
    new Intl.NumberFormat(appLocale(lang), {
      signDisplay: 'always',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(percent),
  );
  return `\u2066${s}%\u2069`;
}

/** Integer counts. Plain numbers are Latin by nature; this documents intent. */
export function formatCount(value: number, lang: Language): string {
  const s = clean(new Intl.NumberFormat(appLocale(lang), { maximumFractionDigits: 0 }).format(value));
  return `\u2066${s}\u2069`;
}
