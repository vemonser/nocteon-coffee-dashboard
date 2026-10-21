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
