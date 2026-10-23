import { Component, computed, inject, input } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { dateParts, formatTime } from '../../../shared/utils/locale-format';

/**
 * Locale date that always renders day-month-year ("13 Oct 2026" /
 * "13 أكتوبر 2026"). Plain-text dates with Latin digits + an Arabic month
 * cannot do this — bidi reorders them in every paragraph direction — so the
 * parts are laid out as DOM-ordered flex spans inside dir="ltr".
 *
 * Tables use short months (default); detail pages pass variant="long".
 *
 * `showTime` appends the time of day as its own span. The time is a
 * separate run for the same reason the date is: "13 Oct 2026" and "2:30 PM"
 * are two different things, and flattening them into one string lets the
 * bidi algorithm swap them.
 */
@Component({
  selector: 'app-localized-date',
  standalone: true,
  imports: [],
  templateUrl: './localized-date.component.html',
})
export class LocalizedDateComponent {
  value = input<unknown>(null);
  fallback = input<string>('—');
  variant = input<'short' | 'long'>('short');
  /** Append the time of day. */
  showTime = input<boolean>(false);
  /** Put the time on its OWN line (a table cell that must stay one line wide). */
  stackTime = input<boolean>(false);

  protected readonly language = inject(LanguageService);

  protected readonly parts = computed(() =>
    dateParts(this.value(), this.language.language(), this.variant()),
  );

  protected readonly time = computed(() => formatTime(this.value(), this.language.language()));
}
