import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheckCircle,
  lucideChevronRight,
  lucideMail,
  lucidePackage,
  lucideShoppingCart,
  lucideStar,
} from '@ng-icons/lucide';
import { DashboardStatsService } from '../../../../features/dashboard/services/dashboard-stats.service';

/**
 * "Needs attention" — a slim strip when everything is clear, a list of
 * actionable rows when it is not.
 *
 * When nothing needs attention the strip is ONE line (48–56 px): a check and
 * a sentence. A full card saying "all clear" is a card that shouts about
 * nothing.
 *
 * When something DOES need attention, each row is a link with a count. The
 * counts are exactly the ones the backend already provides
 * (`ordersByStatus` for pending orders, `pendingReviewsCount`,
 * `lowStockProducts`, `unreadContactMessagesCount`) — no new queries, and no
 * invented numbers. The counts the backend does NOT provide are listed in
 * `evidence/phase4/measurements.json`.
 */
@Component({
  selector: 'app-needs-attention-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoPipe, NgIcon],
  providers: [
    provideIcons({
      lucideCheckCircle,
      lucideChevronRight,
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

  /** The actionable items, with their counts. */
  readonly items = computed(() => {
    const out: {
      key: string;
      count: number;
      icon: string;
      link: string;
      queryParams: Record<string, string>;
    }[] = [];

    const pending = this.stats.pendingOrdersCount();
    if (pending > 0) {
      out.push({
        key: 'needsAttention.pendingOrders',
        count: pending,
        icon: 'lucideShoppingCart',
        link: '/dashboard/orders',
        queryParams: { status: 'PENDING' },
      });
    }

    const reviews = this.stats.pendingReviewsCount();
    if (reviews > 0) {
      out.push({
        key: 'needsAttention.pendingReviews',
        count: reviews,
        icon: 'lucideStar',
        link: '/dashboard/reviews',
        queryParams: { status: 'pending' },
      });
    }

    const lowStock = this.stats.lowStockCount();
    if (lowStock > 0) {
      out.push({
        key: 'needsAttention.lowStock',
        count: lowStock,
        icon: 'lucidePackage',
        link: '/dashboard/products',
        queryParams: { status: 'active', stock: 'low' },
      });
    }

    const unread = this.stats.unreadContactMessagesCount();
    if (unread > 0) {
      out.push({
        key: 'needsAttention.unreadMessages',
        count: unread,
        icon: 'lucideMail',
        link: '/dashboard/contact-messages',
        queryParams: { status: 'unread' },
      });
    }

    return out;
  });

  /** Whether anything needs attention. */
  readonly hasItems = computed(() => this.items().length > 0);
}
