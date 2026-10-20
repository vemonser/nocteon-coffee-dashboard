import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  lucideInfo,
  lucideCircleCheck,
  lucideBanknote,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';

import { OrderService } from '../services/order.service';
import { OrderResponse, OrderStatus } from '../models/order.model';
import {
  OrderNote,
  OrderPaymentDetails,
  OrderShipment,
  OrderStatusHistoryEntry,
} from '../models/order-activity.model';
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
 * One event on the order's timeline.
 *
 * The timeline mixes what the STATUS HISTORY says, what the NOTES say and
 * what the PAYMENT says, so it is one list of events rather than three
 * separate ones.
 */
interface OrderEvent {
  id: string;
  /** When it happened. */
  at: string;
  /** The icon's name. */
  icon: string;
  /** The event's title, already translated. */
  title: string;
  /** The event's detail: the note, the reason, the amount. */
  detail: string | null;
  /** Who it was. */
  actor: string | null;
  /** Whether the customer was to be told. */
  notify: boolean;
}

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
    FormsModule,
    HlmButtonImports,
    HlmDropdownMenuImports,
    HlmTooltipImports,
    BrnTooltip,
    MoneyPipe,
    NgIcon,
    OrderCancelDialogComponent,
    OrderProgressComponent,
    OrderRefundDialogComponent,
    OrderStatusDialogComponent,
    PluralPipe,
    RouterModule,
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
      lucideInfo,
      lucideCircleCheck,
      lucideBanknote,
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

  /** The status history, oldest first. */
  protected readonly history = signal<OrderStatusHistoryEntry[]>([]);
  /** The internal notes, newest first. */
  protected readonly notes = signal<OrderNote[]>([]);
  /** The payment, with the refunds and the net paid. */
  protected readonly payment = signal<OrderPaymentDetails | null>(null);
  /** The shipment, as the store recorded it. */
  protected readonly shipment = signal<OrderShipment | null>(null);
  /** What could not be loaded. */
  protected readonly activityErrors = signal<string[]>([]);

  protected readonly statusDialogOpen = signal(false);
  protected readonly cancelDialogOpen = signal(false);
  protected readonly refundDialogOpen = signal(false);

  /** The note being written. */
  protected readonly noteDraft = signal('');
  protected readonly savingNote = signal(false);

  /** The shipment being written. */
  protected readonly shipmentDraft = signal<{ carrier: string; trackingNumber: string; trackingUrl: string }>({
    carrier: '',
    trackingNumber: '',
    trackingUrl: '',
  });
  protected readonly savingShipment = signal(false);
  protected readonly shipmentEditing = signal(false);

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

  /**
   * The timeline: the status history, the notes and the refunds, newest
   * first.
   *
   * <p>One list, because a reader asks "what happened to this order?" — not
   * "what is in the history and what is in the notes?".
   */
  protected readonly events = computed<OrderEvent[]>(() => {
    const out: OrderEvent[] = [];

    for (const entry of this.history()) {
      const placed = entry.fromStatus === null;
      out.push({
        id: `history-${entry.id}`,
        at: entry.createdAt,
        icon: placed ? 'lucideCircleCheck' : 'lucideHistory',
        title: placed
          ? this.t('orders.timeline.placed', 'Order placed')
          : this.t('orders.timeline.statusChanged', 'Status changed').replace(
              '{{status}}',
              this.names.orderStatus(entry.toStatus),
            ),
        detail: entry.note,
        actor: entry.changedBy,
        notify: entry.notifyCustomer,
      });
    }

    for (const note of this.notes()) {
      out.push({
        id: `note-${note.id}`,
        at: note.createdAt,
        icon: 'lucideStickyNote',
        title: this.t('orders.timeline.note', 'Note added'),
        detail: note.body,
        actor: note.author,
        notify: false,
      });
    }

    for (const refund of this.payment()?.refunds ?? []) {
      out.push({
        id: `refund-${refund.id}`,
        at: refund.createdAt,
        icon: 'lucideRotateCcw',
        title: this.t('orders.timeline.refund', 'Refunded'),
        detail: refund.reason,
        actor: refund.createdBy,
        notify: false,
      });
    }

    return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadOrder(id);
    this.loadActivity(id);

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

  /**
   * The history, the notes and the payment, in one round trip.
   *
   * <p>One of the three failing must not blank the others, so each is
   * caught on its own and the page still shows what it has.
   */
  private loadActivity(id: number): void {
    this.orderService.getActivity(id).subscribe({
      next: ({ history, notes, payment, errors }) => {
        this.history.set(history);
        this.notes.set(notes);
        this.payment.set(payment);
        this.activityErrors.set(errors);
        this.shipment.set(this.order()?.shipment ?? null);
        this.shipmentDraft.set({
          carrier: this.order()?.shipment?.carrier ?? '',
          trackingNumber: this.order()?.shipment?.trackingNumber ?? '',
          trackingUrl: this.order()?.shipment?.trackingUrl ?? '',
        });
      },
      error: () => {
        this.activityErrors.set(['orders.detail.activityUnavailable']);
      },
    });
  }

  protected retry(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadOrder(id);
    this.loadActivity(id);
  }

  protected goBack(): void {
    void this.router.navigate(['/dashboard/orders']);
  }

  // ── the actions ──────────────────────────────────────────────────────────

  protected openStatusDialog(): void {
    this.statusDialogOpen.set(true);
  }

  protected openCancelDialog(): void {
    this.cancelDialogOpen.set(true);
  }

  protected openRefundDialog(): void {
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
   * <p>The note and the reason travel with the request: the backend writes
   * them to the history in the same transaction as the change.
   */
  protected applyStatus(update: { status: OrderStatus; note: string }): void {
    const order = this.order();
    if (!order) return;
    this.updating.set(true);
    this.orderService
      .updateStatus(order.id, { status: update.status, note: update.note })
      .subscribe({
        next: (res) => {
          this.order.set(res.data);
          this.updating.set(false);
          this.statusDialogOpen.set(false);
          this.cancelDialogOpen.set(false);
          this.loadActivity(order.id);
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

  /** Add an internal note. */
  protected addNote(): void {
    const order = this.order();
    const body = this.noteDraft().trim();
    if (!order || !body) return;
    this.savingNote.set(true);
    this.orderService.addNote(order.id, body).subscribe({
      next: () => {
        this.noteDraft.set('');
        this.savingNote.set(false);
        this.loadActivity(order.id);
        this.notify.success('orders.detail.noteAdded', 'Note added');
      },
      error: (err) => {
        this.savingNote.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not add the note');
      },
    });
  }

  /** Record (or change) the shipment. */
  protected saveShipment(): void {
    const order = this.order();
    if (!order) return;
    this.savingShipment.set(true);
    this.orderService
      .updateShipment(order.id, {
        carrier: this.shipmentDraft().carrier,
        trackingNumber: this.shipmentDraft().trackingNumber,
        trackingUrl: this.shipmentDraft().trackingUrl,
      })
      .subscribe({
        next: (res) => {
          this.shipment.set(res.data);
          this.savingShipment.set(false);
          this.shipmentEditing.set(false);
          this.loadActivity(order.id);
          this.notify.success('orders.detail.shipmentSaved', 'Shipment saved');
        },
        error: (err) => {
          this.savingShipment.set(false);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not save the shipment');
        },
      });
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

  protected paymentKind(status: string) {
    return paymentStatusKind(status as never);
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

  /** Translate with an English fallback — never a raw key. */
  protected t(key: string, fallback: string): string {
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }
}
