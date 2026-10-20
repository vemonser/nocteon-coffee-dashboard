import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { StoreSettingsService } from '../../core/settings/store-settings.service';
import { formatCurrency } from '../utils/locale-format';

/**
 * The ONE way money reaches the screen.
 *
 *   {{ order.totalAmount | money }}
 *
 * It reads the store currency from `StoreSettingsService` (GET /api/settings)
 * and the locale from `LanguageService`, and delegates to `formatCurrency`.
 * No template may format money any other way — the `money-formatter` unit
 * test enforces that (see money-formatter.spec.ts).
 */
@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private settings = inject(StoreSettingsService);
  private language = inject(LanguageService);

  transform(value: unknown, currency?: string): string {
    return formatCurrency(
      value,
      this.language.language(),
      currency ?? this.settings.currency(),
    );
  }
}
