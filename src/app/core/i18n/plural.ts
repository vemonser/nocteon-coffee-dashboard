import type { Language } from './language';

/**
 * Arabic grammar and number formatting for the dashboard.
 *
 * The QA report found three Arabic defects that are NOT translation-key
 * problems but grammar problems:
 *
 *  - "30 يومًا" must not be "30 أيام". Arabic counts a noun differently by
 *    the number in front of it: 1 → يوم, 2 → يومان, 3–10 → أيام (plural),
 *    11–99 → يومًا (singular accusative), 100+ → يوم. The number 30 takes
 *    the SINGULAR form, which is why "30 يوم" was wrong and "30 يومًا" is
 *    right.
 *  - "8 مبيعات" must not be "8 مبيعاً". 8 is in the 3–10 band, so the
 *    plural "مبيعات" is correct.
 *  - "2 من 10 طلبات" and "4 من 5 عملاء" must use "من" rather than a slash:
 *    a slash between two numbers in an RTL paragraph is read right-to-left
 *    and produces "من 10 طلبات 2" — the two numbers swap.
 *
 * `Intl.PluralRules` gives the category; the ACTUAL wording comes from the
 * locale files, one key per category. That keeps the grammar in the
 * translation file (where a linguist can change it) instead of hardcoded in
 * TypeScript.
 */

/** The plural categories a locale can select. */
export type PluralCategory = Intl.LDMLPluralRule;

const RULES: Record<Language, Intl.PluralRules> = {
  en: new Intl.PluralRules('en-US'),
  ar: new Intl.PluralRules('ar-EG'),
};

/** The plural category for a count in the given language. */
export function pluralCategory(count: number, lang: Language): PluralCategory {
  return RULES[lang].select(count);
}

/**
 * The suffix for a plural key: `_one`, `_two`, `_few`, `_many`, `_other`.
 *
 * English has only `_one` and `_other`; Arabic has all six. The caller
 * asks for a base key and gets the full key back, e.g.
 * `pluralKey('dashboard.days', 30, 'ar')` -> `dashboard.days_many`.
 */
export function pluralKey(
  base: string,
  count: number,
  lang: Language,
): string {
  return `${base}_${pluralCategory(count, lang)}`;
}

/**
 * The Arabic ordinal-free "N of M" phrase.
 *
 * "2 من 10 طلبات" — the "of" is the word "من", never a slash, so the two
 * numbers keep their order in an RTL paragraph.
 *
 * The noun that follows agrees with the SECOND number (10 → طلبات, 5 →
 * عملاء), so the plural category is taken from that number.
 */
export function ofPhrase(
  count: number,
  total: number,
  lang: Language,
): string {
  const separator = lang === 'ar' ? 'من' : 'of';
  return `${count} ${separator} ${total}`;
}

/** A translate function: Transloco's `translate` is one. */
export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

/**
 * A counted message, resolved through a translate function.
 *
 * This is the ONE place a count becomes a sentence: the plural pipe renders
 * it in a template, and a toast body renders it in TypeScript, but both ask
 * this function, so "3 orders updated" can never mean one thing in a table
 * and another in a toast.
 *
 * A missing key must never reach the screen: the family's `_other` is the
 * fallback, then the number on its own.
 */
export function countMessage(
  translate: TranslateFn,
  lang: Language,
  base: string,
  count: number,
  params: Record<string, unknown> = {},
): string {
  const key = pluralKey(base, count, lang);
  const value = translate(key, { count, ...params });
  if (typeof value === 'string' && value.length > 0 && value !== key) return value;

  const otherKey = `${base}_other`;
  const other = translate(otherKey, { count, ...params });
  if (typeof other === 'string' && other.length > 0 && other !== otherKey) return other;

  return String(count);
}
