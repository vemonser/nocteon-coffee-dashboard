import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideAlertTriangle,
  lucideCheckCircle,
  lucideChevronRight,
  lucideInfo,
  lucideMail,
  lucidePackage,
  lucideShoppingCart,
  lucideStar,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CartService } from '../../../../features/carts/services/cart.service';
import { ContactMessageService } from '../../../../features/contact-messages/services/contact-message.service';
import { ReviewService } from '../../../../features/reviews/services/review.service';
import { DashboardStatsService } from '../../../../features/dashboard/services/dashboard-stats.service';
import {
  buildAttentionItems,
  type AttentionCounts,
} from '../../../../core/dashboard/attention';

/**
 * The Needs attention queue.
 *
 * It is ONE list of queues, not a pile of badges: open orders are counted
 * once (the old panel printed "Pending orders 10" AND "Open orders 40", and
 * the first number was already inside the second), and the pending /
 * processing / shipped split is carried as a detail line so nothing is lost.
 * The rule lives in `core/dashboard/attention.ts` and is unit-tested there.
 *
 * Every state is explicit:
 *  - loading: one skeleton line with the shape of the panel;
 *  - error: what failed, and a retry that re-runs all four reads;
 *  - all clear: one slim line, because "nothing to do" is good news and
 *    does not deserve a card that shouts.
 */
@Component({
  selector: 'app-needs-attention-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoPipe, NgIcon, HlmButtonImports],
  providers: [
    provideIcons({
      lucideAlertTriangle,
      lucideCheckCircle,
      lucideChevronRight,
      lucideInfo,
      lucideMail,
      lucidePackage,
      lucideShoppingCart,
      lucideStar,
    }),
  ],
  templateUrl: './needs-attention-panel.component.html',
  styleUrl: './needs-attention-panel.component.css',
})
export class NeedsAttentionPanelComponent {
  private readonly stats = inject(DashboardStatsService);
  private readonly cartService = inject(CartService);
  private readonly contactService = inject(ContactMessageService);
  private readonly reviewService = inject(ReviewService);

  /**
   * Counts that do not come from the overview endpoint.
   *
   * `null` until every read settles. The rows fall back to the overview
   * counts in the meantime, so the panel never shows a false "all clear".
   */
  private readonly extraCounts = signal<{
    abandonedCarts: number;
    unreadMessages: number;
    pendingReviews: number;
  } | null>(null);

  /** True while the three side reads are in flight. */
  private readonly sideLoading = signal(true);

  /** True when at least one side read failed. */
  private readonly sideFailed = signal(false);

  /**
   * The first load: the overview has never landed. A refetch (switching the
   * range) keeps the previous numbers on screen instead of flashing a
   * skeleton over data the reader is reading.
   */
  readonly loading = computed(
    () =>
      (this.stats.loading() && !this.stats.loaded()) ||
      (!this.stats.loaded() && this.sideLoading()),
  );

  /** The overview failed; the whole queue is untrustworthy. */
  readonly error = computed(() => this.stats.overviewError());

  /** The queue, in operational order. */
  readonly items = computed(() => {
    const data = this.stats.overview();
    const extra = this.extraCounts();
    const status = (name: string): number =>
      data?.ordersByStatus?.find((s) => s.status === name)?.count ?? 0;

    const counts: AttentionCounts = {
      pendingOrders: status('PENDING'),
      confirmedOrders: status('CONFIRMED'),
      processingOrders: status('PROCESSING'),
      shippedOrders: status('SHIPPED'),
      unreadMessages:
        extra?.unreadMessages ?? data?.unreadContactMessagesCount ?? 0,
      pendingReviews:
        extra?.pendingReviews ?? data?.pendingReviewsCount ?? 0,
      lowStock: data?.lowStockProducts?.length ?? 0,
      abandonedCarts: extra?.abandonedCarts ?? 0,
    };

    return buildAttentionItems(counts);
  });

  /** Whether anything needs attention. */
  readonly hasItems = computed(() => this.items().length > 0);

  /** A side read failed but the overview is fine. */
  readonly partial = computed(() => this.sideFailed());

  constructor() {
    this.loadSideCounts();
  }

  /** Re-run every read behind the panel. */
  retry(): void {
    this.stats.retry();
    this.loadSideCounts();
  }

  private loadSideCounts(): void {
    this.sideLoading.set(true);
    this.sideFailed.set(false);

    // `catchError` per source: a broken carts read must not blank the
    // messages queue. A failed source reports 0 and raises the partial flag.
    forkJoin({
      carts: this.cartService.getStats().pipe(
        map((r: any) => Number(r?.data?.abandonedCarts ?? 0) || 0),
        catchError(() => of(-1)),
      ),
      messages: this.contactService.getStats().pipe(
        map((r: any) => Number(r?.data?.unreadCount ?? 0) || 0),
        catchError(() => of(-1)),
      ),
      reviews: this.reviewService.getStats().pipe(
        map((r: any) => Number(r?.data?.pending ?? 0) || 0),
        catchError(() => of(-1)),
      ),
    }).subscribe({
      next: ({ carts, messages, reviews }) => {
        this.sideFailed.set(carts < 0 || messages < 0 || reviews < 0);
        this.extraCounts.set({
          abandonedCarts: Math.max(0, carts),
          unreadMessages: Math.max(0, messages),
          pendingReviews: Math.max(0, reviews),
        });
        this.sideLoading.set(false);
      },
      error: () => {
        this.sideFailed.set(true);
        this.sideLoading.set(false);
      },
    });
  }
}
