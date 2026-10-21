import { Component, computed, inject, input } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { formatDateTime } from '../../utils/locale-format';

/**
 * §4 "Deleted" (Trash tab): relative time as plain text inside a `<time>`,
 * with the absolute timestamp in `datetime` and in the tooltip. The selector
 * name predates this and is kept only because the shared DataTable renders it.
 */
@Component({
  selector: 'app-deleted-badge',
  standalone: true,
  imports: [],
  templateUrl: './deleted-badge.component.html',
})
export class DeletedBadgeComponent {
  date = input<unknown>(null);
  relative = input<string>('');

  private readonly language = inject(LanguageService);

  /** Full local date + time — the tooltip and the screen-reader text. */
  protected readonly absolute = computed(() =>
    formatDateTime(this.date(), this.language.current()),
  );

  /** Reorder-proof, machine-readable value for `<time datetime>`. */
  protected readonly iso = computed(() => {
    const raw = this.date();
    if (raw === null || raw === undefined || raw === '') return null;
    const parsed = raw instanceof Date ? raw : new Date(String(raw));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  });
}
