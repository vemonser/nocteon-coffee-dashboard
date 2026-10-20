import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { OrderDialogComponent } from '../order-dialog/order-dialog.component';

/**
 * The "Refund this order" dialog — and the honest reason it cannot be used.
 *
 * The backend has NO refund endpoint and NO gateway refund call: the only
 * trace of a refund is the payment status `REFUNDED`, and even the AMOUNT is
 * not recorded. Issuing a refund from the dashboard would be a button that
 * lies.
 *
 * So the dialog exists, it explains why it is unavailable, and its confirm
 * button is disabled. The moment the backend grows a real refund endpoint
 * the button is all that has to change.
 */
@Component({
  selector: 'app-order-refund-dialog',
  standalone: true,
  imports: [FormsModule, HlmInputImports, OrderDialogComponent],
  templateUrl: './order-refund-dialog.component.html',
})
export class OrderRefundDialogComponent {
  private readonly transloco = inject(TranslocoService);

  readonly open = input<boolean>(false);
  readonly orderNumber = input<string>('');
  readonly orderTotal = input<number>(0);
  readonly pending = input<boolean>(false);

  readonly confirmed = output<{ amount: number; reason: string }>();
  readonly closed = output<void>();

  readonly amount = signal<string>('');
  readonly reason = signal<string>('');

  protected readonly title = computed(() => this.t('orders.dialogs.refund.title', 'Refund this order'));
  protected readonly unavailable = computed(() =>
    this.t('orders.dialogs.refund.unavailable', 'Refunds are not available'),
  );
  protected readonly unavailableHint = computed(() =>
    this.t(
      'orders.dialogs.refund.unavailableHint',
      'The store has no payment-gateway refund endpoint, so a refund cannot be issued from the dashboard.',
    ),
  );
  protected readonly amountLabel = computed(() => this.t('orders.dialogs.refund.amount', 'Amount'));
  protected readonly reasonLabel = computed(() => this.t('orders.dialogs.refund.reason', 'Reason'));
  protected readonly confirmLabel = computed(() => this.t('orders.dialogs.refund.confirm', 'Refund'));
  protected readonly cancelLabel = computed(() => this.t('common.cancel', 'Cancel'));

  /** Nothing can be confirmed: the capability does not exist. */
  protected readonly canConfirm = computed(() => false);

  protected confirm(): void {
    /* unreachable — the button is disabled */
  }

  reset(): void {
    this.amount.set('');
    this.reason.set('');
  }

  private t(key: string, fallback: string, params?: Record<string, unknown>): string {
    const value = this.transloco.translate(key, params);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }
}
