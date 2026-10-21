import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { OrderDialogComponent } from '../order-dialog/order-dialog.component';

/**
 * The "Cancel this order" dialog.
 *
 * Cancelling is the one status change that needs a REASON and that states
 * its consequence: the order cannot be reopened, and the stock is released.
 * The reason is required — the button stays disabled until it is there.
 */
@Component({
  selector: 'app-order-cancel-dialog',
  standalone: true,
  imports: [FormsModule, HlmInputImports, OrderDialogComponent],
  templateUrl: './order-cancel-dialog.component.html',
})
export class OrderCancelDialogComponent {
  private readonly transloco = inject(TranslocoService);

  readonly open = input<boolean>(false);
  readonly orderNumber = input<string>('');
  readonly pending = input<boolean>(false);

  readonly confirmed = output<{ reason: string }>();
  readonly closed = output<void>();

  readonly reason = signal<string>('');

  protected readonly title = computed(() => this.t('orders.dialogs.cancel.title', 'Cancel this order'));
  protected readonly description = computed(() =>
    this.t(
      'orders.dialogs.cancel.description',
      'Cancelling {{order}} stops the fulfilment and releases the reserved stock.',
      { order: this.orderNumber() },
    ),
  );
  protected readonly reasonLabel = computed(() =>
    this.t('orders.dialogs.cancel.reason', 'Reason (required)'),
  );
  protected readonly reasonPlaceholder = computed(() =>
    this.t('orders.dialogs.cancel.reasonPlaceholder', 'Why is the order being cancelled?'),
  );
  protected readonly consequence = computed(() =>
    this.t(
      'orders.dialogs.cancel.consequence',
      'A cancelled order cannot be reopened. The customer is notified only if you ask for it.',
    ),
  );
  protected readonly confirmLabel = computed(() => this.t('orders.dialogs.cancel.confirm', 'Cancel order'));
  protected readonly cancelLabel = computed(() => this.t('common.cancel', 'Cancel'));

  protected readonly canConfirm = computed(() => this.reason().trim().length > 0);

  /** Each opening starts clean: no reason left from the previous attempt. */
  constructor() {
    effect(() => {
      if (this.open()) this.reset();
    });
  }

  protected confirm(): void {
    if (!this.canConfirm()) return;
    this.confirmed.emit({ reason: this.reason().trim() });
  }

  reset(): void {
    this.reason.set('');
  }

  private t(key: string, fallback: string, params?: Record<string, unknown>): string {
    // React to a runtime language switch: `translate()` is not a signal read.
    this.transloco.activeLang();
    const value = this.transloco.translate(key, params);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }
}
