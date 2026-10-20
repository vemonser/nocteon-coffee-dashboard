import { Component, computed, inject, input } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { dateParts } from '../../../shared/utils/locale-format';

/**
 * Locale date that always renders day-month-year ("13 Oct 2026" /
 * "13 أكتوبر 2026"). Plain-text dates with Latin digits + an Arabic month
 * cannot do this — bidi reorders them in every paragraph direction — so the
 * parts are laid out as DOM-ordered flex spans inside dir="ltr".
 *
 * Tables use short months (default); detail pages pass variant="long".
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

  private readonly language = inject(LanguageService);

  protected readonly parts = computed(() =>
    dateParts(this.value(), this.language.language(), this.variant()),
  );
}
