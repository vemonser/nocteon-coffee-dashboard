import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucidePrinter,
  lucideRefreshCw,
  lucideCircleSlash,
  lucideRotateCcw,
  lucideCopy,
  lucideMoreVertical,
  lucideMail,
  lucidePhone,
  lucideMessageCircle,
  lucideExternalLink,
  lucideTruck,
  lucideTag,
  lucideStickyNote,
  lucideHistory,
  lucidePackage,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';

import { OrderService } from '../services/order.service';
import { OrderResponse, OrderStatus } from '../models/order.model';
import { orderStatusKind, paymentStatusKind, nextStatuses } from '../models/order-status.model';
import { computeOrderTotals, lineTotalsAgree } from '../utils/order-totals';
import { formatOrderNumber, isolatedOrderNumber } from '../utils/order-number';
import { LocalizedNameService } from '../../../core/i18n/localized-name.service';
import { LocalizedDateService } from '../../../core/i18n/localized-date.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { OrderStatusDialogComponent } from '../components/order-status-dialog/order-status-dialog.component';
import { OrderCancelDialogComponent } from '../components/order-cancel-dialog/order-cancel-dialog.component';
import { OrderRefundDialogComponent } from '../components/order-refund-dialog/order-refund-dialog.component';
import { OrderProgressComponent } from '../components/order-progress/order-progress.component';

/**
 * The order detail page.
 *
 * Two columns: the order itself on the left, the facts about it on the
 * right. The page is wide — an order page that only uses half the screen
 * leaves the reader scrolling for the customer's address.
 *
 * Every number comes from the backend. The totals card shows the stored
 * total AND the subtotal the items add up to; when the two disagree the
 * page says so, because a store whose recorded total does not match its own
 * items has a data problem, and hiding it would hide the problem.
 */
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    HlmButtonImports,
    HlmDropdownMenuImports,
    HlmTooltipImports,
    BrnTooltip,
    MoneyPipe,
    NgIcon,
    PluralPipe,
    RouterModule,
    OrderCancelDialogComponent,
    OrderProgressComponent,
    OrderRefundDialogComponent,
    OrderStatusDialogComponent,
    StatusBadgeComponent,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucidePrinter,
      lucideRefreshCw,
      lucideCircleSlash,
      lucideRotateCcw,
      lucideCopy,
      lucideMoreVertical,
      lucideMail,
      lucidePhone,
      lucideMessageCircle,
      lucideExternalLink,
      lucideTruck,
      lucideTag,
      lucideStickyNote,
      lucideHistory,
      lucidePackage,
    }),
  ],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  protected readonly names = inject(LocalizedNameService);
  protected readonly dates = inject(LocalizedDateService);
  protected readonly language = inject(LanguageService);

  protected readonly order = signal<OrderResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly updating = signal(false);

  protected readonly statusDialogOpen = signal(false);
  protected readonly cancelDialogOpen = signal(false);
  protected readonly refundDialogOpen = signal(false);

  /** The dialogs, so their state can be reset when they open. */
  private readonly statusDialog = viewChild(OrderStatusDialogComponent);
  private readonly cancelDialog = viewChild(OrderCancelDialogComponent);
  private readonly refundDialog = viewChild(OrderRefundDialogComponent);

  protected readonly orderNumber = computed(() =>
    isolatedOrderNumber(this.order()?.orderNumber, this.order()?.id),
  );

  protected readonly totals = computed(() => computeOrderTotals(this.order()));

  /** Do the item line totals agree with their own price and quantity? */
  protected readonly linesAgree = computed(() => lineTotalsAgree(this.order()));

  /** Does the recorded total match the items? */
  protected readonly totalsMatch = computed(() => this.totals().consistent);

  /** Can this order still change status? */
  protected readonly canChangeStatus = computed(() => {
    const order = this.order();
    return !!order && nextStatuses(order.status).length > 0;
  });

  /** Can this order still be cancelled? */
  protected readonly canCancel = computed(() => {
    const order = this.order();
    return !!order && nextStatuses(order.status).includes('CANCELLED');
  });

  /** The absolute date and time, for the tooltip. */
  protected readonly createdAtTitle = computed(() =>
    this.dates.formatDateAndTime(this.order()?.createdAt),
  );

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadOrder(id);

    // The list links here with `?action=changeStatus` / `?action=cancel`, so
    // a bulk action lands on the order with the right dialog open.
    const action = this.route.snapshot.queryParamMap.get('action');
    if (action === 'changeStatus') this.statusDialogOpen.set(true);
    if (action === 'cancel') this.cancelDialogOpen.set(true);

    // `?print=1` prints the order — the invoice.
    if (this.route.snapshot.queryParamMap.get('print') === '1') {
      setTimeout(() => window.print(), 600);
    }
  }

  private loadOrder(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.orderService.getById(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'orders.errorState.title');
      },
    });
  }

  protected retry(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadOrder(id);
  }

  protected goBack(): void {
    void this.router.navigate(['/dashboard/orders']);
  }

  // ── the actions ──────────────────────────────────────────────────────────

  protected openStatusDialog(): void {
    this.statusDialog()?.reset();
    this.statusDialogOpen.set(true);
  }

  protected openCancelDialog(): void {
    this.cancelDialog()?.reset();
    this.cancelDialogOpen.set(true);
  }

  protected openRefundDialog(): void {
    this.refundDialog()?.reset();
    this.refundDialogOpen.set(true);
  }

  protected closeStatusDialog(): void {
    this.statusDialogOpen.set(false);
  }

  protected closeCancelDialog(): void {
    this.cancelDialogOpen.set(false);
  }

  protected closeRefundDialog(): void {
    this.refundDialogOpen.set(false);
  }

  /**
   * Apply a status change.
   *
   * The endpoint is `PUT /api/dashboard/orders/{id}/status`. The note is sent
   * with the request; the backend ignores it today (there is no note field
   * on a status change) — the contract for it is in ORDERS_CONTRACT.md.
   */
  protected applyStatus(update: { status: OrderStatus; note: string }): void {
    const order = this.order();
    if (!order) return;
    this.updating.set(true);
    this.orderService.updateStatus(order.id, { status: update.status, note: update.note }).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.updating.set(false);
        this.statusDialogOpen.set(false);
        this.cancelDialogOpen.set(false);
        this.notify.success('notify.statusUpdated', 'Status updated');
      },
      error: (err) => {
        this.updating.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not update the order status');
      },
    });
  }

  protected applyCancel(cancel: { reason: string }): void {
    this.applyStatus({ status: 'CANCELLED', note: cancel.reason });
  }

  protected printInvoice(): void {
    window.print();
  }

  /** The address as one block, for the clipboard. */
  protected addressText(): string {
    const address = this.order()?.address;
    if (!address) return '';
    return [
      address.fullName,
      address.street,
      [address.city, address.state].filter(Boolean).join(', '),
      [address.country, address.postalCode].filter(Boolean).join(' '),
      address.phone,
    ]
      .filter(Boolean)
      .join('\n');
  }

  protected async copyAddress(): Promise<void> {
    const text = this.addressText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.notify.success('orders.detail.addressCopied', 'Address copied');
    } catch {
      this.notify.apiError(null, 'notify.errorFallback', 'Could not copy the address');
    }
  }

  /** A `tel:` link — the phone number without its formatting. */
  protected telHref(): string | null {
    const phone = this.order()?.address?.phone;
    if (!phone) return null;
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
  }

  /** A WhatsApp link — the phone number without its formatting. */
  protected whatsappHref(): string | null {
    const phone = this.order()?.address?.phone;
    if (!phone) return null;
    return `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
  }

  /** The order number, plain (for a `title` attribute). */
  protected plainOrderNumber(): string {
    return formatOrderNumber(this.order()?.orderNumber, this.order()?.id);
  }

  protected statusKind(status: OrderStatus) {
    return orderStatusKind(status);
  }

  /** "City, State" — the parts that exist, joined. */
  protected cityLine(): string {
    const address = this.order()?.address;
    if (!address) return '';
    return [address.city, address.state].filter((part) => !!part).join(', ');
  }

  /** "Country 12577" — the parts that exist, joined. */
  protected countryLine(): string {
    const address = this.order()?.address;
    if (!address) return '';
    return [address.country, address.postalCode].filter((part) => !!part).join(' ');
  }

  protected paymentKind(status: string) {
    return paymentStatusKind(status as never);
  }

  protected t(key: string, fallback: string): string {
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }
}
