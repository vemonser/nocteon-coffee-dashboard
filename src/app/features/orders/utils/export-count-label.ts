import { pluralCategory } from '../../../core/i18n/plural';
import type { Language } from '../../../core/i18n/language';

/**
 * The orders export buttons' label — "Export 128 orders" / "تصدير 128 طلبًا".
 *
 * FE-19: the button states the row count, because the action exports the
 * whole VIEW (filter ∩ tab), not the page on screen — a number the reader
 * cannot otherwise see next to the button.
 *
 * The wording lives in the locale files, one key per plural category
 * (`orders.export.count_<category>`), so the grammar stays with the
 * translation instead of being hardcoded here. English has one/other;
 * Arabic has all six Intl.PluralRules categories, which is why the family is
 * asymmetric on purpose.
 *
 * Arabic states 0, 1 and 2 with words ("لا طلبات", "طلب واحد", "طلبان") and
 * prints the digit from 3 upward — exactly how the header count
 * (`orders.countOrders`) already reads, so the two never disagree.
 */
export const EXPORT_COUNT_BASE = 'orders.export.count';

/**
 * The count a label may show.
 *
 * The API owns `totalElements`, but a label must never print "NaN orders" or
 * "-1 orders" if a response is malformed (AGENTS.md rule 9).
 */
export function exportCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.trunc(count));
}

/** The plural key for the export label at a count, e.g. `orders.export.count_many`. */
export function exportCountKey(count: number, lang: Language): string {
  return `${EXPORT_COUNT_BASE}_${pluralCategory(exportCount(count), lang)}`;
}

/**
 * The resolved label for a count.
 *
 * The `translate` argument is injected so this stays a pure function the spec
 * can exercise without a Transloco runtime.
 */
export function exportCountLabel(
  count: number,
  lang: Language,
  translate: (key: string, params: Record<string, unknown>) => string,
): string {
  const value = exportCount(count);
  const params = { count: value };
  const key = exportCountKey(value, lang);
  const label = translate(key, params);
  if (label && label !== key) return label;

  // A missing category must never reach the screen: fall back to `_other`,
  // which every locale defines.
  const otherKey = `${EXPORT_COUNT_BASE}_other`;
  const other = translate(otherKey, params);
  if (other && other !== otherKey) return other;

  return String(value);
}
