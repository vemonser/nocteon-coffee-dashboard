import { Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideXCircle } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import type { OrderStatus } from '../../models/order.model';
import { FULFILMENT_CHAIN } from '../../models/order-status.model';

/**
 * The order progress tracker.
 *
 * `Placed → Confirmed → Processing → Shipped → Delivered`.
 *
 * The steps BEFORE the current one are done, the current one is the one the
 * order is at, and the ones after it are muted — a future step is never
 * drawn as if it had happened.
 *
 * A CANCELLED order leaves the chain: the chain is replaced by the
 * destructive branch, with the reason when the store recorded one.
 *
 * Everything here is derived from the order's CURRENT status, so it needs no
 * backend history endpoint.
 */
@Component({
  selector: 'app-order-progress',
  standalone: true,
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideCheck, lucideXCircle })],
  templateUrl: './order-progress.component.html',
})
export class OrderProgressComponent {
  readonly status = input.required<OrderStatus>();
  /** The cancellation reason, when the store recorded one. */
  readonly cancelReason = input<string | null>(null);

  protected readonly chain = FULFILMENT_CHAIN;

  /** The index of the current step in the chain, or -1 for a cancelled order. */
  protected readonly currentIndex = computed(() => this.chain.indexOf(this.status()));

  protected readonly isCancelled = computed(() => this.status() === 'CANCELLED');

  /** Has this step already happened? */
  protected isDone(step: OrderStatus): boolean {
    const index = this.currentIndex();
    return index >= 0 && this.chain.indexOf(step) < index;
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
}
