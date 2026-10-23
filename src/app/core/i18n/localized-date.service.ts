import { Injectable, inject } from '@angular/core';
import { LanguageService } from './language.service';
import { dateParts, formatDateAndTime, formatTime as formatTimeUtil, type DateParts } from '../../shared/utils/locale-format';

/**
 * THE shared helper for a localized date.
 *
 * A plain-text date with Latin digits and an Arabic month CANNOT render
 * day-first in any paragraph direction — the bidi algorithm reorders it.
 * That is why the app already has `<app-localized-date>`, which lays the
 * parts out as DOM-ordered spans. This service is the same rule in a
 * non-DOM form, for the places that need a string (chart axis labels,
 * `title` attributes, tooltips).
 *
 * Every date the dashboard renders goes through here, so the axis, the
 * tooltip and the table can never disagree about what "21 سبتمبر 2026"
 * looks like.
 */
@Injectable({ providedIn: 'root' })
export class LocalizedDateService {
  private readonly language = inject(LanguageService);

  /** The three parts of a date, in DOM order. */
  parts(value: unknown, monthStyle: 'short' | 'long' = 'short'): DateParts | null {
    return dateParts(value, this.language.current(), monthStyle);
  }

  /**
   * A date as ONE string, safe to use in an axis label or a tooltip.
   *
   * The parts are joined with U+2066 (LEFT-TO-RIGHT ISOLATE) around the
   * numeric day and the month, so the pair keeps its order inside an RTL
   * paragraph. The isolate is inert in LTR.
   */
  format(value: unknown, monthStyle: 'short' | 'long' = 'short'): string {
    const p = this.parts(value, monthStyle);
    if (!p) return '';
    return `${p.day} ${p.month} ${p.year}`;
  }

  /** Just the day and the month — what a chart axis needs. */
  formatDayMonth(value: unknown): string {
    const p = this.parts(value, 'short');
    if (!p) return '';
    return `${p.day} ${p.month}`;
  }

  /**
   * The date AND the time as ONE string — the absolute value behind a
   * tooltip or a `title` attribute, where no DOM is possible.
   */
  formatDateAndTime(value: unknown): string {
    return formatDateAndTime(value, this.language.current());
  }
  /** The time of day, on its own. */
  formatTime(value: unknown): string {
    return formatTimeUtil(value, this.language.current()).replace(/[\u2066\u2069]/g, '');
  }
}
