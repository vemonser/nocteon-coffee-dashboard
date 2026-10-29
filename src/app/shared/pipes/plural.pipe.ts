import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { countMessage } from '../../core/i18n/plural';
import { TranslocoService } from '@jsverse/transloco';

/**
 * A count rendered in the grammar of the current language.
 *
 *   {{ 30 | plural: 'dashboard.days' }}     -> "30 days" / "30 يومًا"
 *   {{ 8  | plural: 'dashboard.sold' }}     -> "8 sold"   / "8 مبيعات"
 *
 * The category comes from `Intl.PluralRules`, and the WORDING comes from
 * the locale file (`<base>_<category>`). That keeps the grammar where a
 * linguist can change it, instead of hardcoded in TypeScript.
 *
 * Arabic counts a noun by the number in front of it, so 30 takes the
 * singular ("يومًا") and 8 takes the plural ("مبيعات") — see
 * `core/i18n/plural.ts`.
 *
 * The lookup itself lives in `countMessage`, because a toast body has no
 * template to run a pipe in and both must word a count the same way.
 *
 * `pure: false` because the result depends on the active language, which is
 * not an input to the pipe.
 */
@Pipe({ name: 'plural', standalone: true, pure: false })
export class PluralPipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  transform(count: number, base: string, params: Record<string, unknown> = {}): string {
    return countMessage(
      (key, values) => this.transloco.translate(key, values),
      this.language.language(),
      base,
      count,
      params,
    );
  }
}
