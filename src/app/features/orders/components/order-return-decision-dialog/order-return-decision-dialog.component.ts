import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { OrderDialogComponent } from '../order-dialog/order-dialog.component';
import { LanguageService } from '../../../../core/i18n/language.service';
import { countMessage } from '../../../../core/i18n/plural';
import type { OrderReturnItem } from '../../models/order-activity.model';

/**
 * "Approve this return" / "Reject this return" (FE-20).
 *
 * <p>The confirmation states the CONSEQUENCE in units, because the two buttons
 * are not symmetric: approving puts stock back (through the movement log),
 * rejecting leaves the shelf exactly as it is. An admin who reads only the
 * title would not know that.
 *
 * <p>The footer follows the app's dialog order: destructive first, then the
 * secondary at the end. Rejecting is the only action, so it leads; approving
 * is the primary and sits last after Cancel.
 */
@Component({
  selector: 'app-order-return-decision-dialog',
  standalone: true,
  imports: [OrderDialogComponent, TranslocoPipe],
  templateUrl: './order-return-decision-dialog.component.html',
})
export class OrderReturnDecisionDialogComponent {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);

  readonly open = input<boolean>(false);
  readonly mode = input<'approve' | 'reject'>('approve');
  /** The return's lines, so the confirm can name them and their quantities. */
  readonly lines = input<readonly OrderReturnItem[]>([]);
  readonly pending = input<boolean>(false);

  readonly confirmed = output<void>();
  readonly closed = output<void>();

  protected readonly isApprove = computed(() => this.mode() === 'approve');

  protected readonly title = computed(() =>
    this.isApprove()
      ? this.t('orders.returns.decision.approveTitle', 'Approve this return')
      : this.t('orders.returns.decision.rejectTitle', 'Reject this return'),
  );

  protected readonly description = computed(() =>
    this.isApprove()
      ? this.t(
          'orders.returns.decision.approveDescription',
          'The units go back into stock, and the stock log records the change.',
        )
      : this.t(
          'orders.returns.decision.rejectDescription',
          'Nothing goes back into stock — the decision is final.',
        ),
  );

  protected readonly confirmLabel = computed(() =>
    this.isApprove()
      ? this.t('orders.returns.decision.approve', 'Approve return')
      : this.t('orders.returns.decision.reject', 'Reject return'),
  );

  protected readonly cancelLabel = computed(() => this.t('common.cancel', 'Cancel'));

  private t(key: string, fallback: string, params?: Record<string, unknown>): string {
    // Read the active language: `translate()` is not a signal read, so a
    // runtime switch must re-render the confirm's copy too.
    this.transloco.activeLang();
    const value = this.transloco.translate(key, params);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }

  /**
   * "3 units of Ethiopia Yirgacheffe" in the reader's grammar.
   *
   * <p>The Arabic form depends on the count (1, 2, 3–10, 11–99, 100+), so the
   * sentence comes from the plural family rather than from string
   * concatenation.
   */
  protected restockSentence(line: OrderReturnItem): string {
    const product = line.productName ?? line.sku ?? '';
    return countMessage(
      (key, params) => this.transloco.translate(key, params),
      this.language.language(),
      'orders.returns.decision.unitsOf',
      line.quantity,
      { product },
    );
  }
}
