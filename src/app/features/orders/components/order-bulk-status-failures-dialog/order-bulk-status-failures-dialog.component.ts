import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../../../core/i18n/language.service';
import { countMessage } from '../../../../core/i18n/plural';
import { OrderDialogComponent } from '../order-dialog/order-dialog.component';
import type { BulkStatusResult } from '../../utils/bulk-status';

/**
 * The per-row failure list of a bulk status run (FE-18).
 *
 * <p>A bulk run can succeed for nine rows and be refused for three, and the
 * three refusals are the only part the admin can act on — so they are listed
 * one per line with the ORDER NUMBER and the SERVER's own reason, not folded
 * into "some orders failed".
 *
 * <p>"Retry failed" closes this dialog and reopens the bulk dialog with the
 * rows still selected, so the retry goes through the same transition check
 * instead of re-sending a request the state machine already refused.
 */
@Component({
  selector: 'app-order-bulk-status-failures-dialog',
  standalone: true,
  imports: [OrderDialogComponent],
  templateUrl: './order-bulk-status-failures-dialog.component.html',
})
export class OrderBulkStatusFailuresDialogComponent {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);

  readonly open = input<boolean>(false);
  readonly failures = input<readonly BulkStatusResult[]>([]);

  readonly closed = output<void>();
  readonly retried = output<void>();

  protected readonly title = computed(() =>
    this.t('orders.bulk.failures.title', 'Some orders were not updated'),
  );

  /** "3 orders were not updated" — a count, so it follows the language's grammar. */
  protected readonly description = computed(() =>
    this.plural('orders.bulk.failed', this.failures().length),
  );

  protected readonly hint = computed(() =>
    this.t(
      'orders.bulk.failures.hint',
      'They are still selected, so you can retry the change.',
    ),
  );

  protected readonly confirmLabel = computed(() =>
    this.t('orders.bulk.failures.retry', 'Retry failed'),
  );

  protected readonly cancelLabel = computed(() =>
    this.t('orders.bulk.failures.close', 'Close'),
  );

  protected readonly canRetry = computed(() => this.failures().length > 0);

  private t(key: string, fallback: string): string {
    this.transloco.activeLang();
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }

  private plural(base: string, count: number): string {
    this.transloco.activeLang();
    return countMessage(
      (key, values) => this.transloco.translate(key, values),
      this.language.language(),
      base,
      count,
    );
  }
}
