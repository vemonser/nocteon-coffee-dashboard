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
 * CURRENCY (Phase 1, ticket 1.3)
 * ------------------------------
 * There is exactly ONE money formatter in the app: `formatCurrency`. It is
 * fed by the store currency setting (`GET /api/settings` -> `currency`) and
 * used by KPIs, charts, tables, tooltips and the CSV export.
 *
 * The currency DISPLAY is locale-dependent, not hardcoded:
 *   - English  -> `narrowSymbol` ("E£1,176.25")
 *   - Arabic   -> `symbol` ("1,176.25 ج.م.")
 * `narrowSymbol` in the `ar` locale still yields the Latin "E£" because
 * CLDR's narrow symbol for EGP is locale-independent in that locale; the
 * `symbol` display gives the Arabic "ج.م.". Digits stay Latin in both.
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

/** The one and only money formatter. */
export function formatCurrency(
  value: unknown,
  lang: Language,
  currency: string,
): string {
  const n =
    typeof value === 'number'
      ? value
      : Number.parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return `\u2066${String(value ?? '')}\u2069`;
  const s = clean(
    new Intl.NumberFormat(appLocale(lang), {
      style: 'currency',
      currency,
      // Arabic gets the Arabic currency symbol ("ج.م."); English gets the
      // narrow one ("E£"). `narrowSymbol` alone renders "E£" in BOTH
      // locales, which is what the QA report flagged.
      currencyDisplay: lang === 'ar' ? 'symbol' : 'narrowSymbol',
    }).format(n),
  );
  return `\u2066${s}\u2069`;
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
