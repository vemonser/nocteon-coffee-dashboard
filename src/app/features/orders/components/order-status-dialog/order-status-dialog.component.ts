import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { OrderDialogComponent } from '../order-dialog/order-dialog.component';
import type { OrderStatus } from '../../models/order.model';
import { nextStatuses } from '../../models/order-status.model';

/**
 * The "Update status" dialog.
 *
 * It offers ONLY the transitions the backend's state machine allows (see
 * `ALLOWED_TRANSITIONS`), so the dialog can never ask for a change the order
 * does not accept — a delivered or a cancelled order offers nothing at all.
 *
 * CANCELLING is not here: it has its own dialog (a reason is required and
 * the consequence is stated), so the two never disagree about what a cancel
 * means.
 *
 * The NOTE is sent to the API, which currently ignores it (the backend has
 * no note field on a status change) — that gap is in ORDERS_CONTRACT.md.
 */
@Component({
  selector: 'app-order-status-dialog',
  standalone: true,
  imports: [FormsModule, HlmButtonImports, HlmInputImports, OrderDialogComponent],
  templateUrl: './order-status-dialog.component.html',
})
export class OrderStatusDialogComponent {
  private readonly transloco = inject(TranslocoService);

  readonly open = input<boolean>(false);
  readonly orderNumber = input<string>('');
  readonly currentStatus = input<OrderStatus>('PENDING');
  readonly pending = input<boolean>(false);

  readonly confirmed = output<{ status: OrderStatus; note: string }>();
  readonly closed = output<void>();

  /** The status the admin picked. */
  readonly selected = signal<OrderStatus | null>(null);
  readonly note = signal<string>('');

  /** The transitions the backend allows from the current status. */
  protected readonly options = computed(() =>
    nextStatuses(this.currentStatus()).filter((status) => status !== 'CANCELLED'),
  );

  protected readonly hasOptions = computed(() => this.options().length > 0);

  protected readonly title = computed(() => this.t('orders.dialogs.status.title', 'Update status'));

  protected readonly description = computed(() =>
    this.hasOptions()
      ? this.t(
          'orders.dialogs.status.description',
          'Move {{order}} from {{from}} to {{to}}.',
          {
            order: this.orderNumber(),
            from: this.statusName(this.currentStatus()),
            to: this.statusName(this.selected() ?? this.options()[0]),
          },
        )
      : this.t(
          'orders.dialogs.status.noTransitions',
          'This order has reached a final status and cannot be changed.',
        ),
  );

  protected readonly confirmLabel = computed(() =>
    this.t('orders.dialogs.status.confirm', 'Update status'),
  );

  protected readonly cancelLabel = computed(() => this.t('common.cancel', 'Cancel'));

  protected readonly noteLabel = computed(() =>
    this.t('orders.dialogs.status.note', 'Note (optional)'),
  );
  protected readonly notePlaceholder = computed(() =>
    this.t('orders.dialogs.status.notePlaceholder', 'Why is the status changing?'),
  );

  protected readonly canConfirm = computed(() => this.selected() !== null);

  protected statusName(status: OrderStatus): string {
    return this.t(`orders.statuses.${status}`, status);
  }

  protected pick(status: OrderStatus): void {
    this.selected.set(status);
  }

  protected confirm(): void {
    const status = this.selected();
    if (!status) return;
    this.confirmed.emit({ status, note: this.note().trim() });
  }

  /** Reset when the dialog opens, so a previous attempt never carries over. */
  reset(): void {
    this.selected.set(null);
    this.note.set('');
  }

  private t(key: string, fallback: string, params?: Record<string, unknown>): string {
    const value = this.transloco.translate(key, params);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }
}
