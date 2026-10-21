import type { Language } from './language';
import { appLocale } from '../../shared/utils/locale-format';

/**
 * The relative time — "2 hours ago", "منذ ساعتين".
 *
 * <p>There is ONE implementation of this in the app. The shared table had
 * one and the recent-orders widget had another, and they drifted; the
 * table's version read the language off `document.documentElement.lang`,
 * which is the DOM's state rather than the app's.
 *
 * <p>Under a minute it is "Just now" / "الآن" — the number of seconds is
 * noise, and the absolute value is in the tooltip anyway.
 */
export function formatRelativeTime(value: unknown, lang: Language): string {
  if (value === null || value === undefined || value === '') return '';
  const then = new Date(value as string).getTime();
  if (Number.isNaN(then)) return '';

  const diff = then - Date.now();
  const absDiff = Math.abs(diff);
  if (absDiff < 60_000) return lang === 'ar' ? 'الآن' : 'Just now';

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 3600e3],
    ['month', 30 * 24 * 3600e3],
    ['week', 7 * 24 * 3600e3],
    ['day', 24 * 3600e3],
    ['hour', 3600e3],
    ['minute', 60e3],
  ];

  const rtf = new Intl.RelativeTimeFormat(appLocale(lang), { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (absDiff >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return lang === 'ar' ? 'الآن' : 'Just now';
}
