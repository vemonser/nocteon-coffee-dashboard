import { Component, computed, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideRotateCcw, lucideXCircle } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import type { OrderStatus, PaymentStatus } from '../../models/order.model';
import { FULFILMENT_CHAIN } from '../../models/order-status.model';
import { LocalizedDateService } from '../../../../core/i18n/localized-date.service';

/** The recorded date and actor of one step, when the backend has them. */
export interface OrderStepRecord {
  at: string;
  actor: string | null;
}

/**
 * The order progress tracker.
 *
 * `Placed → Confirmed → Processing → Shipped → Delivered`.
 *
 * The steps BEFORE the current one are done (a check), the current step is
 * distinct (a ring), and the steps after it are muted — a future step is
 * never drawn as if it had happened. DELIVERED is a terminal success, so
 * its own step is drawn as DONE as well: a delivered order that showed "5"
 * in a filled circle read like a stage still in progress.
 *
 * A CANCELLED order leaves the chain entirely; a REFUNDED payment gets its
 * own terminal strip above the chain (the fulfilment it reached is still
 * true). Neither is drawn as step 5.
 *
 * Dates and actors come from the status history when the backend records
 * it. When it does not, the tracker says so once instead of inventing them.
 */
@Component({
  selector: 'app-order-progress',
  standalone: true,
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideCheck, lucideRotateCcw, lucideXCircle })],
  templateUrl: './order-progress.component.html',
})
export class OrderProgressComponent {
  private readonly dates = inject(LocalizedDateService);

  readonly status = input.required<OrderStatus>();
  /** The payment status, so a refund can render as a terminal state. */
  readonly paymentStatus = input<PaymentStatus | null>(null);
  /** The cancellation reason, when the store recorded one. */
  readonly cancelReason = input<string | null>(null);
  /** Recorded history per status, keyed by the status the order moved TO. */
  readonly stepRecords = input<Partial<Record<OrderStatus, OrderStepRecord>>>({});
  /** True when the store returned no history at all. */
  readonly historyMissing = input<boolean>(false);

  protected readonly chain = FULFILMENT_CHAIN;

  /** The index of the current step in the chain, or -1 for a cancelled order. */
  protected readonly currentIndex = computed(() => this.chain.indexOf(this.status()));

  protected readonly isCancelled = computed(() => this.status() === 'CANCELLED');
  protected readonly isRefunded = computed(() => this.paymentStatus() === 'REFUNDED');

  /** Has this step already happened? Delivered is done as well as current. */
  protected isDone(step: OrderStatus): boolean {
    const index = this.currentIndex();
    if (index < 0) return false;
    const stepIndex = this.chain.indexOf(step);
    return stepIndex < index || (stepIndex === index && this.status() === 'DELIVERED');
  }

  /** Is this the step the order is at? */
  protected isCurrent(step: OrderStatus): boolean {
    return step === this.status();
  }

  /** Is this step still in the future? */
  protected isFuture(step: OrderStatus): boolean {
    const index = this.currentIndex();
    return index >= 0 && this.chain.indexOf(step) > index;
  }

  /** The recorded date of a step, or null. */
  protected stepDate(step: OrderStatus): string | null {
    const record = this.stepRecords()[step];
    return record ? this.dates.formatDateAndTime(record.at) : null;
  }

  /** The recorded actor of a step, or null. */
  protected stepActor(step: OrderStatus): string | null {
    return this.stepRecords()[step]?.actor ?? null;
  }

  /** Is any step dated? (When none are, the gap is stated once.) */
  protected readonly hasAnyStepRecord = computed(() =>
    Object.values(this.stepRecords()).some((record) => !!record?.at),
  );
}
