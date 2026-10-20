import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { OrderDialogComponent } from '../order-dialog/order-dialog.component';

/**
 * The "Refund this order" dialog.
 *
 * <p>The money leaves the store through the PAYMENT GATEWAY: the backend
 * calls Paymob first and records the refund only when the gateway has
 * accepted it. So this dialog does two things and refuses the third:
 *
 * <ul>
 *   <li>it sends the AMOUNT (the whole order, or a part of it) and a
 *       REASON — the amount is what makes the net paid computable;</li>
 *   <li>it shows the gateway's own refusal when there is one, so nobody is
 *       told the money went back when it did not;</li>
 *   <li>it cannot refund an order that was never paid, and the backend
 *       refuses it too.</li>
 * </ul>
 */
@Component({
  selector: 'app-order-refund-dialog',
  standalone: true,
  imports: [FormsModule, HlmButtonImports, HlmInputImports, OrderDialogComponent, TranslocoPipe],
  templateUrl: './order-refund-dialog.component.html',
})
export class OrderRefundDialogComponent {
  private readonly transloco = inject(TranslocoService);

  readonly open = input<boolean>(false);
  readonly orderNumber = input<string>('');
  /** The order's total — the default amount of a full refund. */
  readonly orderTotal = input<number>(0);
  /** What has already been given back, so the dialog can say what is left. */
  readonly alreadyRefunded = input<number>(0);
  readonly pending = input<boolean>(false);

  readonly confirmed = output<{ amount: number; reason: string }>();
  readonly closed = output<void>();

  /** The amount being refunded. */
  readonly amount = signal<string>('');
  /** Why the money is going back. */
  readonly reason = signal<string>('');

  /** What is still refundable. */
  protected readonly remaining = computed(() =>
    Math.max(0, this.orderTotal() - this.alreadyRefunded()),
  );

  /** Two decimals, without the toFixed the money guard forbids. */
  private static twoDecimals(value: number): string {
    return String(Math.round(value * 100) / 100);
  }

  protected readonly amountNumber = computed(() => Number(this.amount()) || 0);

  protected readonly canConfirm = computed(
    () =>
      this.amountNumber() > 0 &&
      this.amountNumber() <= this.remaining() &&
      this.reason().trim().length > 0,
  );

  protected readonly title = computed(() => this.t('orders.dialogs.refund.title', 'Refund this order'));
  protected readonly confirmLabel = computed(() => this.t('orders.dialogs.refund.confirm', 'Refund'));
  protected readonly cancelLabel = computed(() => this.t('common.cancel', 'Cancel'));
  protected readonly amountLabel = computed(() => this.t('orders.dialogs.refund.amount', 'Amount'));
  protected readonly reasonLabel = computed(() => this.t('orders.dialogs.refund.reason', 'Reason'));
  protected readonly reasonPlaceholder = computed(() =>
    this.t('orders.dialogs.refund.reasonPlaceholder', 'Why is the money going back?'),
  );

  protected readonly fullRefund = computed(() => this.t('orders.dialogs.refund.full', 'Full refund'));
  protected readonly partialRefund = computed(() =>
    this.t('orders.dialogs.refund.partial', 'Partial refund'),
  );
  protected readonly remainingLine = computed(() => {
    const key = 'orders.dialogs.refund.remaining';
    const fallback = 'Remaining to refund: {{amount}}';
    const value = this.transloco.translate(key, { amount: OrderRefundDialogComponent.twoDecimals(this.remaining()) });
    return typeof value === 'string' && value !== key ? value : fallback;
  });
  protected readonly tooMuch = computed(() =>
    this.t('orders.dialogs.refund.tooMuch', 'The amount is more than what is left to refund.'),
  );
  protected readonly gatewayNote = computed(() =>
    this.t(
      'orders.dialogs.refund.gatewayNote',
      'The money goes back through the payment gateway. The customer is refunded on the same card.',
    ),
  );

  constructor() {
    // The dialog fills itself when it OPENS: the amount is what is left to
    // refund, and the reason starts empty. A dialog that opens with an empty
    // amount asks the admin to do arithmetic.
    effect(() => {
      if (this.open()) {
        this.amount.set(OrderRefundDialogComponent.twoDecimals(this.remaining()));
        this.reason.set('');
      }
    });
  }

  /** Start from the whole amount, and reset the reason. */
  protected useFullAmount(): void {
    this.amount.set(OrderRefundDialogComponent.twoDecimals(this.remaining()));
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.confirmed.emit({ amount: this.amountNumber(), reason: this.reason().trim() });
  }

  /** Reset when the dialog opens, so a previous attempt never carries over. */
  reset(): void {
    this.amount.set(OrderRefundDialogComponent.twoDecimals(this.remaining()));
    this.reason.set('');
  }

  private t(key: string, fallback: string): string {
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }
}
