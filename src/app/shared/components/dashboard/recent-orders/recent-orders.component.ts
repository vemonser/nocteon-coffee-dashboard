import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { TranslocoPipe } from '@jsverse/transloco';
import { Router, RouterLink } from '@angular/router';
import { OrderService } from '../../../../features/orders/services/order.service';
import { OrderResponse, OrderStatus } from '../../../../features/orders/models/order.model';
import { MoneyPipe } from '../../../pipes/money.pipe';
import { WidgetStateComponent } from '../../widget-state/widget-state.component';
import { LanguageService } from '../../../../core/i18n/language.service';
import { StatusBadgeComponent } from '../../../ui/status-badge/status-badge.component';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePackage } from '@ng-icons/lucide';

/**
 * The recent orders.
 *
 * Each row is a LINK to the order, so a reader can go from a number to the
 * order behind it in one click. The date is RELATIVE when it is recent
 * ("2 hours ago") and absolute when it is not, because "3 months ago" is
 * more useful than a date. The customer name comes from the order.
 *
 * The "View all" link lives in the CARD HEADER, once — the copy that used to
 * sit at the bottom of the list was the same link twice.
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

  /** A RELATIVE date for the recent ones, an absolute one for the rest. */
  relativeDate(value: unknown): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const minutes = Math.round(diffMs / 60000);
    const isAr = this.language.current() === 'ar';

    if (minutes < 1) {
      return isAr ? 'الآن' : 'just now';
    }
    if (minutes < 60) {
      const n = isAr ? `${minutes} دقيقة` : `${minutes} min`;
      return isAr ? `منذ ${n}` : `${n} ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      const n = isAr ? `${hours} ساعة` : `${hours} hour${hours === 1 ? '' : 's'}`;
      return isAr ? `منذ ${n}` : `${n} ago`;
    }
    const days = Math.round(hours / 24);
    if (days < 7) {
      const n = isAr ? `${days} يوم` : `${days} day${days === 1 ? '' : 's'}`;
      return isAr ? `منذ ${n}` : `${n} ago`;
    }
    // Older than a week: the absolute date is more useful.
    return this.absoluteDate(d);
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
