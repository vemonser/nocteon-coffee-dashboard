import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Router, RouterLink } from '@angular/router';
import { OrderService } from '../../../../features/orders/services/order.service';
import { OrderResponse, OrderStatus } from '../../../../features/orders/models/order.model';
import { MoneyPipe } from '../../../pipes/money.pipe';
import { WidgetStateComponent } from '../../widget-state/widget-state.component';
import { LanguageService } from '../../../../core/i18n/language.service';
import { StatusBadgeComponent } from '../../../ui/status-badge/status-badge.component';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePackage } from '@ng-icons/lucide';
import { isolatedOrderNumber } from '../../../../features/orders/utils/order-number';
import { pluralKey } from '../../../../core/i18n/plural';

/**
 * The recent orders.
 *
 * Each row is a LINK to the order, so a reader can go from a number to the
 * order behind it in one click. The date is RELATIVE when it is recent
 * ("2 hours ago") and absolute when it is not, because "3 months ago" is
 * more useful than a date. The customer name comes from the order.
 *
 * THE ORDER NUMBER (Round 2, ticket 1.4): the number is the backend's own
 * (`ORD-2026-000001`), shown through the SHARED helper, so the dashboard,
 * the list, the detail page and the export all print the same thing. The
 * old code printed `order.orderNumber || '#' + order.id` inline, which is
 * a second formatter.
 *
 * THE RELATIVE TIME (Round 2, ticket 2.1): the wording comes from the
 * locale file, in the right plural form, in both languages. It used to be
 * hardcoded in the component, so it was one more place where a language
 * could be wrong.
 */
@Component({
  selector: 'app-recent-orders',
  standalone: true,
  imports: [
    CommonModule,
    HlmAvatarImports,
    HlmBadgeImports,
    TranslocoPipe,
    RouterLink,
    MoneyPipe,
    WidgetStateComponent,
    StatusBadgeComponent,
    NgIcon,
  ],
  providers: [provideIcons({ lucidePackage })],
  templateUrl: './recent-orders.component.html',
  styleUrl: './recent-orders.component.css',
})
export class RecentOrdersComponent implements OnInit {
  private orderService = inject(OrderService);
  private language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly orders = signal<OrderResponse[]>([]);

  ngOnInit(): void {
    this.loadRecentOrders();
  }

  loadRecentOrders(): void {
    this.loading.set(true);
    this.error.set(null);

    this.orderService
      .getAll({
        page: 0,
        size: 4,
        sort: 'createdAt',
        direction: 'desc',
      })
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.orders.set(res.data.content);
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load recent orders');
          this.loading.set(false);
        },
      });
  }

  /**
   * The order number, through the SHARED helper.
   *
   * The number is a Latin token inside a right-to-left paragraph, so it is
   * wrapped in an isolate: without it the bidi algorithm can reorder the
   * segments of `ORD-2026-000001`.
   */
  orderNumber(order: OrderResponse): string {
    return isolatedOrderNumber(order.orderNumber, order.id);
  }

  /** A RELATIVE date for the recent ones, an absolute one for the rest. */
  relativeDate(value: unknown): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const minutes = Math.round(diffMs / 60000);

    if (minutes < 1) {
      return this.transloco.translate('dashboard.recentOrders.justNow');
    }
    if (minutes < 60) {
      return this.relative(minutes, 'dashboard.recentOrders.minutesAgo');
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      return this.relative(hours, 'dashboard.recentOrders.hoursAgo');
    }
    const days = Math.round(hours / 24);
    if (days < 7) {
      return this.relative(days, 'dashboard.recentOrders.daysAgo');
    }
    // Older than a week: the absolute date is more useful.
    return this.absoluteDate(d);
  }

  /**
   * A relative time in the reader's language, in the right plural form.
   *
   * The CATEGORY comes from `Intl.PluralRules` and the WORDING comes from
   * the locale file, so Arabic counts the noun the way Arabic counts it.
   */
  private relative(count: number, base: string): string {
    const key = pluralKey(base, count, this.language.current());
    return this.transloco.translate(key, { count });
  }

  /** The absolute date, with the time. */
  absoluteDate(value: unknown): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    const locale =
      this.language.current() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  /** The title attribute of the date: always the absolute one. */
  dateTitle(value: unknown): string {
    return this.absoluteDate(value);
  }

  /** The fallback for an order with no customer. */
  readonly unknownCustomer = computed(() => {
    // The language is read FIRST: `transloco.translate()` is not reactive on
    // its own, so a computed that only calls it keeps the language it was
    // built in.
    this.language.language();
    return this.transloco.translate('dashboard.recentOrders.unknownCustomer');
  });

  /** Map API status to StatusBadgeComponent StatusKind. */
  getStatusKind(status: string): import('../../../ui/status-badge/status-badge.component').StatusKind {
    const map: Record<string, import('../../../ui/status-badge/status-badge.component').StatusKind> = {
      PENDING: 'pending',
      PAID: 'paid',
      PROCESSING: 'processing',
      SHIPPED: 'shipped',
      DELIVERED: 'delivered',
      CANCELLED: 'cancelled',
      REFUNDED: 'refunded',
    };
    return map[status] ?? 'pending';
  }
}
