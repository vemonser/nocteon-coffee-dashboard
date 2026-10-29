import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucidePrinter,
  lucideFileDown,
  lucideLoader,
  lucideSend,
  lucideRefreshCw,
  lucideCircleSlash,
  lucideRotateCcw,
  lucideCopy,
  lucideMoreVertical,
  lucideMail,
  lucidePhone,
  lucideMessageCircle,
  lucideExternalLink,
  lucideChevronRight,
  lucideTruck,
  lucideStickyNote,
  lucideHistory,
  lucideInfo,
  lucideBanknote,
  lucideCheckCircle,
  lucidePackage,
  lucideTriangleAlert,
  lucideUser,
  lucideClipboard,
  lucideLink,
  lucideEye,
  lucideUndo2,
  lucidePlus,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';
import { catchError, forkJoin, map, of } from 'rxjs';

import { OrderService } from '../services/order.service';
import { ProductService } from '../../products/services/product.service';
import type { ProductDetail } from '../../products/models/product.models';
import { OrderResponse, OrderStatus, PaymentStatus, PaymentMethod } from '../models/order.model';
import {
  CreateReturnPayload,
  OrderNote,
  OrderPaymentDetails,
  OrderRefund,
  OrderReturn,
  OrderShipment,
  OrderStatusHistoryEntry,
} from '../models/order-activity.model';
import { orderStatusKind, paymentStatusKind, nextStatuses, effectivePaymentStatus, canChangeStatus, canCancel, canRefund } from '../models/order-status.model';
import { computeOrderTotals } from '../utils/order-totals';
import { computeSettlement } from '../utils/order-settlement';
import { summarizeCustomerOrders, type CustomerSummary } from '../utils/customer-summary';
import { formatOrderNumber, isolatedOrderNumber } from '../utils/order-number';
import { orderItemsCount, orderLinesCount } from '../utils/order-items-count';
import { buildOrderEvents, type OrderEvent } from '../adapters/order-activity.adapter';
import {
  buildOrderItemViews,
  type VariantInfo,
} from '../adapters/order-items.adapter';
import { LocalizedNameService } from '../../../core/i18n/localized-name.service';
import { LocalizedDateService } from '../../../core/i18n/localized-date.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { countMessage } from '../../../core/i18n/plural';
import { NotifyService } from '../../../core/notify/notify.service';
import { PermissionService } from '../../../core/auth/permission.service';
import { BreadcrumbService } from '../../../shared/components/breadcrumb/service/breadcrumb.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/components/error-state/error-state.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { OrderStatusDialogComponent } from '../components/order-status-dialog/order-status-dialog.component';
import { OrderCancelDialogComponent } from '../components/order-cancel-dialog/order-cancel-dialog.component';
import { OrderRefundDialogComponent } from '../components/order-refund-dialog/order-refund-dialog.component';
import { OrderProgressComponent, type OrderStepRecord } from '../components/order-progress/order-progress.component';
import { OrderReturnDialogComponent } from '../components/order-return-dialog/order-return-dialog.component';
import { OrderReturnDecisionDialogComponent } from '../components/order-return-decision-dialog/order-return-decision-dialog.component';
import {
  OrderShipmentDialogComponent,
  type ShipmentDraft,
} from '../components/order-shipment-dialog/order-shipment-dialog.component';

/** One event, translated for the template. */
interface OrderEventView extends OrderEvent {
  icon: string;
  title: string;
  actorLabel: string | null;
}

/**
 * The order detail page — v5.
 *
 * <p>Two columns: the order on the left, the facts about it on the right.
 * The numbers are the product: the total is the backend's stored value, the
 * settlement separates paid from refunded from still owed, and a value the
 * store does not record is stated as missing — never rendered as a silent
 * dash that looks like a zero.
 *
 * <p>Every event on the timeline is a recorded timestamp. The backend now
 * returns status history; the page shows the progress tracker with recorded
 * dates and a merged activity log. When history is empty, it shows the
 * order's creation and says the store does not record the rest.
 */
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HlmButtonImports,
    HlmDropdownMenuImports,
    HlmTextareaImports,
    HlmTooltipImports,
    BrnTooltip,
    MoneyPipe,
    NgIcon,
    OrderCancelDialogComponent,
    OrderProgressComponent,
    OrderRefundDialogComponent,
    OrderReturnDecisionDialogComponent,
    OrderReturnDialogComponent,
    OrderShipmentDialogComponent,
    OrderStatusDialogComponent,
    PluralPipe,
    RouterModule,
    StatusBadgeComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucidePrinter,
      lucideFileDown,
      lucideLoader,
      lucideSend,
      lucideRefreshCw,
      lucideCircleSlash,
      lucideRotateCcw,
      lucideCopy,
      lucideMoreVertical,
      lucideMail,
      lucidePhone,
      lucideMessageCircle,
      lucideExternalLink,
      lucideChevronRight,
      lucideTruck,
      lucideStickyNote,
      lucideHistory,
      lucideInfo,
      lucideBanknote,
      lucideCheckCircle,
      lucidePackage,
      lucideTriangleAlert,
      lucideUser,
      lucideClipboard,
      lucideLink,
      lucideEye,
      lucideUndo2,
      lucidePlus,
    }),
  ],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.css',
})
export class OrderDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly productService = inject(ProductService);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  private readonly breadcrumb = inject(BreadcrumbService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissions = inject(PermissionService);
  protected readonly names = inject(LocalizedNameService);
  protected readonly dates = inject(LocalizedDateService);
  protected readonly language = inject(LanguageService);

  protected readonly order = signal<OrderResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notFound = signal(false);
  protected readonly updating = signal(false);

  /** The status history, oldest first. */
  protected readonly history = signal<OrderStatusHistoryEntry[]>([]);
  /** The internal notes, newest first. */
  protected readonly notes = signal<OrderNote[]>([]);
  /** The payment, with the refunds the store recorded. */
  protected readonly payment = signal<OrderPaymentDetails | null>(null);
  /** The shipment, as the store recorded it. */
  protected readonly shipment = signal<OrderShipment | null>(null);
  /** The returns of this order, newest first. */
  protected readonly returns = signal<OrderReturn[]>([]);
  /** The returns are loading / failed — their own little surface. */
  protected readonly returnsLoading = signal(false);
  protected readonly returnsError = signal<string | null>(null);
  protected readonly returnsLoaded = signal(false);
  /** What could not be loaded. */
  protected readonly activityErrors = signal<string[]>([]);
  protected readonly activityLoaded = signal(false);

  /** The customer's order count and paid lifetime value (no aggregate endpoint). */
  protected readonly customerSummary = signal<CustomerSummary | null>(null);
  protected readonly customerSummaryLoading = signal(false);

  /** The catalog variants of this order's lines, keyed by variant id. */
  private readonly variants = signal<ReadonlyMap<number, VariantInfo>>(new Map());

  protected readonly statusDialogOpen = signal(false);
  protected readonly cancelDialogOpen = signal(false);
  protected readonly refundDialogOpen = signal(false);
  protected readonly shipmentDialogOpen = signal(false);
  protected readonly returnDialogOpen = signal(false);
  protected readonly decisionDialogOpen = signal(false);
  /** The return the decision dialog is about. */
  protected readonly decisionTarget = signal<OrderReturn | null>(null);
  protected readonly decisionMode = signal<'approve' | 'reject'>('approve');
  protected readonly savingReturn = signal(false);
  protected readonly decidingReturn = signal(false);

  /** The note being written. */
  protected readonly noteDraft = signal('');
  protected readonly savingNote = signal(false);
  private readonly noteInput = viewChild<ElementRef<HTMLTextAreaElement>>('noteInput');

  /** Where the Orders crumb returns to — the list URL that linked here. */
  protected readonly returnUrl = signal('/dashboard/orders');

  protected readonly orderNumber = computed(() =>
    isolatedOrderNumber(this.order()?.orderNumber, this.order()?.id),
  );

  protected readonly totals = computed(() => computeOrderTotals(this.order()));

  protected readonly settlement = computed(() =>
    computeSettlement(this.order(), this.payment()),
  );

  protected readonly itemViews = computed(() =>
    buildOrderItemViews(this.order()?.items ?? [], this.variants()),
  );

  protected readonly itemsCount = computed(() => orderItemsCount(this.order()));
  protected readonly linesCount = computed(() => orderLinesCount(this.order()));

  /** Can this order still change status? */
  protected readonly canChangeStatus = computed(() => {
    const order = this.order();
    return !!order && canChangeStatus(order);
  });

  /** Can this order still be cancelled? */
  protected readonly canCancel = computed(() => {
    const order = this.order();
    return !!order && canCancel(order);
  });

  /** Can money go back? Only a payment the store marks PAID. */
  protected readonly canRefund = computed(() => {
    const order = this.order();
    return !!order && canRefund(order) && !this.updating();
  });

  protected readonly alreadyRefunded = computed(() => {
    const refunds = this.payment()?.refunds ?? [];
    return refunds.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0);
  });

  /** The absolute date and time, for the tooltip. */
  protected readonly createdAtTitle = computed(() =>
    this.dates.formatDateAndTime(this.order()?.createdAt),
  );

  /** Does the store record a status history for this order? */
  protected readonly historyMissing = computed(
    () => this.activityLoaded() && this.history().length === 0 && this.activityErrors().length === 0,
  );

  /** The recorded date/actor of each completed step, keyed by the status reached. */
  protected readonly stepRecords = computed<Partial<Record<OrderStatus, OrderStepRecord>>>(() => {
    const records: Partial<Record<OrderStatus, OrderStepRecord>> = {};
    for (const entry of this.history()) {
      // A row that is an EVENT (a return) carries the order's status at the
      // time, not a step the order reached — it must not overwrite the step's
      // real date and actor.
      if (entry.eventType) continue;
      records[entry.toStatus as OrderStatus] = {
        at: entry.createdAt,
        actor: entry.changedBy,
      };
    }
    return records;
  });

  /** The activity log, newest first. Recorded timestamps only. */
  protected readonly events = computed<OrderEventView[]>(() => {
    const order = this.order();
    if (!order) return [];

    const built = buildOrderEvents({
      order: { createdAt: order.createdAt },
      history: this.history(),
      notes: this.notes(),
      refunds: this.payment()?.refunds ?? [],
      payment: this.payment(),
      shipment: this.shipment(),
    });

    return built.map((event) => ({
      ...event,
      icon: this.eventIcon(event),
      title: this.eventTitle(event),
      actorLabel: event.actor && !this.isSystemActor(event.actor)
        ? this.t('orders.timeline.by', 'by {{actor}}', { actor: this.actorName(event.actor) })
        : null,
    }));
  });

  /** Whether an event is in the future. */
  protected isFutureEvent(event: OrderEventView): boolean {
    const ms = Date.parse(event.at);
    if (Number.isNaN(ms)) return false;
    return ms > Date.now();
  }

  /** Whether the events list is expanded. */
  protected readonly eventsExpanded = signal(false);

  /** The visible events (first 4 or all if expanded). */
  protected readonly visibleEvents = computed(() => {
    const all = this.events();
    if (this.eventsExpanded() || all.length <= 4) return all;
    return all.slice(0, 4);
  });

  /** Toggle events expanded state. */
  protected toggleEventsExpanded(): void {
    this.eventsExpanded.set(!this.eventsExpanded());
  }

  /** Check if actor is a system actor. */
  private isSystemActor(actor: string): boolean {
    const value = actor.trim().toLowerCase();
    return value === 'seed' || value.startsWith('system');
  }

  /** The reason "Update status" cannot be used, translated, or null. */
  protected readonly statusDisabledReason = computed(() => {
    const order = this.order();
    if (!order) return null;
    if (this.updating()) return this.t('orders.detail.statusSaving', 'A change is already being saved.');
    if (order.status === 'DELIVERED') {
      return this.t(
        'orders.detail.statusLockedDelivered',
        'Delivered is a final status — the order cannot move again.',
      );
    }
    if (order.status === 'CANCELLED') {
      return this.t(
        'orders.detail.statusLockedCancelled',
        'This order was cancelled — its status cannot change.',
      );
    }
    return null;
  });

  /** The reason "Refund" cannot be used, translated, or null. */
  protected readonly refundDisabledReason = computed(() => {
    const order = this.order();
    if (!order) return null;
    if (order.paymentStatus === 'REFUNDED') {
      return this.t('orders.detail.refundLockedRefunded', 'This order has already been refunded.');
    }
    if (order.paymentStatus !== 'PAID') {
      return this.t(
        'orders.detail.refundLockedUnpaid',
        'Only a paid order can be refunded — this payment is not paid.',
      );
    }
    return null;
  });

  /** The reason "Cancel" cannot be used, translated, or null. */
  protected readonly cancelDisabledReason = computed(() => {
    const order = this.order();
    if (!order) return null;
    if (order.status === 'CANCELLED') {
      return this.t('orders.detail.cancelLockedCancelled', 'The order is already cancelled.');
    }
    if (!this.canCancel()) {
      return this.t(
        'orders.detail.cancelLockedFinal',
        'A delivered order cannot be cancelled.',
      );
    }
    return null;
  });

  /** Is a confirmation being sent right now? Guards the double press. */
  protected readonly resendingConfirmation = signal(false);
  /** Is the invoice being fetched right now? */
  protected readonly downloadingInvoice = signal(false);

  /**
   * Re-sending needs `order:update`, the same authority the backend demands.
   * Hiding the item is the client side of the rule; the server still refuses.
   */
  protected readonly canResendConfirmation = computed(
    () => this.permissions.has('order:update') && !this.resendingConfirmation(),
  );

  /** Does the store have a shipment to show? */
  protected readonly hasShipment = computed(() => {
    const shipment = this.shipment();
    return !!(
      shipment?.carrier ||
      shipment?.trackingNumber ||
      shipment?.shippedAt ||
      shipment?.deliveredAt
    );
  });

  /** A shipped/delivered order with no shipment on record is a data problem. */
  protected readonly shipmentMissingForStatus = computed(() => {
    const status = this.order()?.status;
    return (status === 'SHIPPED' || status === 'DELIVERED') && !this.hasShipment();
  });

  // ── returns / RMA (FE-20) ────────────────────────────────────────────────

  /**
   * Can this order carry a return?
   *
   * <p>A cancelled order was never delivered, so there is nothing to send
   * back — the backend refuses it with the same rule. An order with no lines
   * has nothing to return either.
   */
  protected readonly canHaveReturns = computed(() => {
    const order = this.order();
    return !!order && order.status !== 'CANCELLED' && (order.items?.length ?? 0) > 0;
  });

  /**
   * Units already returned (or being returned) per order line.
   *
   * <p>This is the form's cap: a rejected return brought nothing back, so its
   * units are still returnable. The server enforces the same sum.
   */
  protected readonly returnedByItem = computed<ReadonlyMap<number, number>>(() => {
    const map = new Map<number, number>();
    for (const ret of this.returns()) {
      if (ret.status === 'REJECTED') continue;
      for (const line of ret.items) {
        map.set(line.orderItemId, (map.get(line.orderItemId) ?? 0) + line.quantity);
      }
    }
    return map;
  });

  /** The order's lines, with what is still returnable — the dialog's rows. */
  protected readonly returnableLines = computed(() => {
    const order = this.order();
    if (!order) return [];
    return order.items.map((item) => {
      const returned = this.returnedByItem().get(item.id) ?? 0;
      return {
        id: item.id,
        productName: item.productName,
        sku: item.sku,
        ordered: item.quantity,
        returned,
        available: Math.max(0, item.quantity - returned),
      };
    });
  });

  /** Is anything still returnable? Otherwise there is no "Create return" to offer. */
  protected readonly hasReturnableLines = computed(() =>
    this.returnableLines().some((line) => line.available > 0),
  );

  /** Only a REQUESTED return can be decided, and only with `order:update`. */
  protected readonly canDecideReturns = computed(() => this.permissions.has('order:update'));

  protected canDecide(ret: OrderReturn): boolean {
    return ret.status === 'REQUESTED' && this.canDecideReturns() && !this.decidingReturn();
  }

  /** The stock the catalog currently reports for a returned line's variant. */
  protected stockOf(variantId: number | null): number | null {
    if (variantId === null) return null;
    return this.variants().get(variantId)?.stockQuantity ?? null;
  }

  /**
   * "9 units in stock" / "9 وحدات في المخزون" — the catalog's figure, worded
   * in the reader's grammar. Null when the catalog has not resolved it.
   */
  protected stockLabel(variantId: number | null): string | null {
    const stock = this.stockOf(variantId);
    if (stock === null) return null;
    return countMessage(
      (key, params) => this.transloco.translate(key, params),
      this.language.language(),
      'orders.returns.inStock',
      stock,
    );
  }
  /** The badge kind for a return status — one vocabulary for the whole app. */
  protected returnKind(status: string): 'pending' | 'approved' | 'rejected' {
    if (status === 'APPROVED') return 'approved';
    if (status === 'REJECTED') return 'rejected';
    return 'pending';
  }

  /** The allowed next statuses for the dropdown. */
  protected readonly allowedNextStatuses = computed(() => {
    const order = this.order();
    return order ? nextStatuses(order.status) : [];
  });

  /** The effective payment status for display (NOT_COLLECTED for cancelled COD). */
  protected readonly displayPaymentStatus = computed(() => {
    const order = this.order();
    if (!order) return 'PENDING';
    return effectivePaymentStatus(order);
  });

  private wasDark = false;
  /** True between `beforeprint` and `afterprint`, so the pair is idempotent. */
  private printing = false;
  /** The id currently on screen — the URL, not a stale snapshot. */
  private currentId = 0;
  /** Invalidates an in-flight variant request when the order or language changes. */
  private variantRequest = 0;
  /** Invalidates an in-flight customer-summary request when the order changes. */
  private customerRequest = 0;
  private printTimer: ReturnType<typeof setTimeout> | null = null;
  /** One-shot intent read from the query string (`?action=`, `?print=1`). */
  private queryAction: string | null = null;
  private queryPrint = false;
  private handledAction: string | null = null;
  private handledPrint = false;

  constructor() {
    this.returnUrl.set(this.resolveReturnUrl());

    // The id comes from the ROUTE, not from a snapshot: navigating from one
    // order to another reuses this component, and a snapshot would keep
    // showing the first order (and append its number to the breadcrumb).
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('id'));
      this.currentId = Number.isFinite(id) && id > 0 ? id : 0;
      this.handledAction = null;
      this.handledPrint = false;
      this.cancelPendingPrint();
      this.resetActivity();
      if (this.currentId === 0) {
        this.loading.set(false);
        this.notFound.set(true);
        return;
      }
      this.loadOrder(this.currentId);
      this.loadActivity(this.currentId);
      this.loadReturns(this.currentId);
      this.applyQueryIntent();
    });

    // The list links here with `?action=changeStatus` / `?action=cancel`, and
    // `?print=1` prints the invoice. The intent is applied only AFTER the
    // order has loaded, so a disabled action can never open its dialog by URL.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.queryAction = params.get('action');
      this.queryPrint = params.get('print') === '1';
      this.applyQueryIntent();
    });

    // The invoice is printed on the LIGHT stylesheet, whatever the screen is
    // in: a dark-mode print would put a black background on paper.
    const enterPrint = () => this.enterPrintMode();
    const exitPrint = () => this.exitPrintMode();
    window.addEventListener('beforeprint', enterPrint);
    window.addEventListener('afterprint', exitPrint);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('beforeprint', enterPrint);
      window.removeEventListener('afterprint', exitPrint);
      this.cancelPendingPrint();
      this.exitPrintMode();
    });

    // The variant's weight/grind comes from the CATALOG, and the catalog
    // localizes its option values. A page that switched language at runtime
    // would otherwise keep the previous language's option label on the line.
    // The language SIGNAL is the dependency (not `langChanges$`, which fires
    // before the request interceptor can see the new language).
    effect(() => {
      this.language.language();
      const order = this.order();
      if (order) this.loadVariants(order);
    });
  }

  /** Drop everything that belongs to the previous order before loading the next. */
  private resetActivity(): void {
    this.order.set(null);
    this.history.set([]);
    this.notes.set([]);
    this.payment.set(null);
    this.shipment.set(null);
    this.returns.set([]);
    this.returnsLoading.set(false);
    this.returnsError.set(null);
    this.returnsLoaded.set(false);
    this.decisionTarget.set(null);
    this.decisionDialogOpen.set(false);
    this.returnDialogOpen.set(false);
    this.activityErrors.set([]);
    this.activityLoaded.set(false);
    this.variants.set(new Map());
    this.customerSummary.set(null);
    this.customerSummaryLoading.set(false);
  }

  /**
   * Apply `?action=` / `?print=` once the order is on screen.
   *
   * <p>Both are one-shot: re-loading the order (after a refund, say) must not
   * reopen a dialog or print again. An action the state machine does not
   * allow is ignored, exactly like its disabled button.
   */
  private applyQueryIntent(): void {
    if (!this.order()) return;

    if (this.queryAction && this.queryAction !== this.handledAction) {
      this.handledAction = this.queryAction;
      if (this.queryAction === 'changeStatus' && !this.statusDisabledReason()) {
        this.statusDialogOpen.set(true);
      }
      if (this.queryAction === 'cancel' && !this.cancelDisabledReason()) {
        this.cancelDialogOpen.set(true);
      }
    }

    if (this.queryPrint && !this.handledPrint) {
      this.handledPrint = true;
      this.cancelPendingPrint();
      this.printTimer = setTimeout(() => {
        this.printTimer = null;
        this.printInvoice();
      }, 600);
    }
  }

  private cancelPendingPrint(): void {
    if (this.printTimer === null) return;
    clearTimeout(this.printTimer);
    this.printTimer = null;
  }

  /**
   * The URL that linked here, when it is the orders LIST.
   *
   * <p>Angular hands the previous navigation to the current one, query
   * string included. That is how the Orders crumb returns to the same
   * filtered list without the Orders list having to know about this page.
   */
  private resolveReturnUrl(): string {
    const previous = this.router.getCurrentNavigation()?.previousNavigation?.finalUrl?.toString();
    if (previous && /^\/dashboard\/orders(\?|$)/.test(previous)) return previous;
    return '/dashboard/orders';
  }

  private loadOrder(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    this.orderService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          // A slower response for a previous id must not overwrite the order
          // the URL now points at.
          if (this.currentId !== id) return;
          const order = res.data;
          this.order.set(order);
          this.loading.set(false);
          this.shipment.set(order.shipment ?? null);
          this.breadcrumb.appendCrumb(this.orderNumber());
          this.breadcrumb.updateCrumbLink('/dashboard/orders', this.returnUrl());
          // `loadVariants` runs from the effect below, which also re-runs when
          // the language changes (the catalog localizes option values).
          if (order.customer?.id) this.loadCustomerSummary(order.customer.id);
          this.applyQueryIntent();
        },
        error: (err) => {
          if (this.currentId !== id) return;
          this.loading.set(false);
          if (err?.status === 404) {
            this.notFound.set(true);
            return;
          }
          this.error.set(
            err?.error?.message ??
              this.t('orders.detail.loadError', 'The order could not be loaded'),
          );
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
    this.orderService
      .getActivity(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ history, notes, payment, errors }) => {
          if (this.currentId !== id) return;
          this.history.set(history);
          this.notes.set(notes);
          this.payment.set(payment);
          this.activityErrors.set(errors);
          this.activityLoaded.set(true);
          const order = this.order();
          if (order) this.shipment.set(order.shipment ?? null);
        },
        error: () => {
          if (this.currentId !== id) return;
          this.activityLoaded.set(true);
          this.activityErrors.set(['orders.detail.activityUnavailable']);
        },
      });
  }

  /**
   * The returns of this order, newest first.
   *
   * <p>Its own surface: a failing returns read must not blank the order, the
   * timeline or the notes, so it has its own loading / error / retry state.
   */
  private loadReturns(id: number): void {
    this.returnsLoading.set(true);
    this.returnsError.set(null);
    this.orderService
      .getReturns(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (this.currentId !== id) return;
          this.returns.set(res.data ?? []);
          this.returnsLoading.set(false);
          this.returnsLoaded.set(true);
        },
        error: (err: unknown) => {
          if (this.currentId !== id) return;
          this.returnsLoading.set(false);
          this.returnsLoaded.set(true);
          this.returnsError.set(
            this.apiMessage(err) ?? this.t('orders.returns.loadError', 'The returns could not be loaded'),
          );
        },
      });
  }

  /**
   * Resolve the weight/grind/compare-at of every line from the catalog.
   *
   * <p>The order line carries `variantId` only; the product detail carries
   * the variant. A failed product read leaves the line intact without the
   * variant label — it never blocks the order.
   */
  private loadVariants(order: OrderResponse): void {
    const request = ++this.variantRequest;
    const slugs = Array.from(
      new Set(order.items.map((item) => item.productSlug).filter((slug): slug is string => !!slug)),
    );
    if (slugs.length === 0) {
      this.variants.set(new Map());
      return;
    }

    forkJoin(
      slugs.map((slug) =>
        this.productService.getBySlug(slug).pipe(
          map((res) => res.data as ProductDetail | null),
          catchError(() => of(null)),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((products) => {
        // A language switch starts a new request; the previous one must not
        // land after it and restore the old option labels.
        if (request !== this.variantRequest) return;
        const map = new Map<number, VariantInfo>();
        for (const product of products) {
          for (const variant of product?.variants ?? []) {
            if (typeof variant.id !== 'number') continue;
            map.set(variant.id, {
              id: variant.id,
              sku: variant.sku ?? null,
              compareAtPrice: variant.compareAtPrice ?? null,
              attributes: (variant.optionValues ?? []).map((option) => ({
                name: option.optionName,
                value: option.value,
              })),
              stockQuantity: variant.stockQuantity ?? null,
            });
          }
        }
        this.variants.set(map);
      });
  }

  /**
   * Order count and paid lifetime value from the customer's own orders.
   *
   * <p>There is no customer-aggregate endpoint (API_GAPS.md); the list
   * endpoint accepts a `userId`, so the page reads the customer's orders
   * and sums the PAID ones. The basis is stated in the tooltip.
   */
  private loadCustomerSummary(customerId: number): void {
    const request = ++this.customerRequest;
    this.customerSummaryLoading.set(true);
    this.orderService
      .getEveryOrder({ userId: customerId })
      .pipe(
        // The backend accepts `userId` but silently ignores it, returning every
        // order in the system (API_GAPS.md). Filter client-side to the customer's
        // own orders before summarising.
        map((orders) => summarizeCustomerOrders(orders.filter((o) => o.customer?.id === customerId))),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((summary) => {
        if (request !== this.customerRequest) return;
        this.customerSummary.set(summary);
        this.customerSummaryLoading.set(false);
      });
  }

  protected retry(): void {
    if (this.currentId <= 0) return;
    this.loadOrder(this.currentId);
    this.loadActivity(this.currentId);
  }

  protected goBack(): void {
    void this.router.navigateByUrl(this.returnUrl());
  }

  // ── the actions ──────────────────────────────────────────────────────────

  protected openStatusDialog(): void {
    if (this.statusDisabledReason()) return;
    this.statusDialogOpen.set(true);
  }

  protected openCancelDialog(): void {
    if (this.cancelDisabledReason()) return;
    this.cancelDialogOpen.set(true);
  }

  protected openRefundDialog(): void {
    if (this.refundDisabledReason()) return;
    this.refundDialogOpen.set(true);
  }

  protected openShipmentDialog(): void {
    this.shipmentDialogOpen.set(true);
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

  protected closeShipmentDialog(): void {
    this.shipmentDialogOpen.set(false);
  }

  /**
   * Apply a status change.
   *
   * <p>The note and the notify flag travel with the request; the backend
   * writes them to the history in the same transaction as the change.
   */
  protected applyStatus(update: { status: OrderStatus; note: string; notifyCustomer: boolean }): void {
    const order = this.order();
    if (!order) return;
    this.updating.set(true);
    this.orderService
      .updateStatus(order.id, {
        status: update.status,
        note: update.note,
        notifyCustomer: update.notifyCustomer,
      })
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
    this.applyStatus({ status: 'CANCELLED', note: cancel.reason, notifyCustomer: false });
  }

  protected printInvoice(): void {
    this.enterPrintMode();
    window.print();
  }

  /** Remove dark mode for the print, remembering whether to restore it. */
  private enterPrintMode(): void {
    // `printInvoice()` calls this and the `beforeprint` event calls it again;
    // the pair must be idempotent or the second call would remember "light"
    // and leave a dark screen light after printing.
    if (this.printing) return;
    this.printing = true;
    this.wasDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('order-print');
  }

  private exitPrintMode(): void {
    if (!this.printing) return;
    this.printing = false;
    document.documentElement.classList.toggle('dark', this.wasDark);
    document.documentElement.classList.remove('order-print');
    this.wasDark = false;
  }

  /**
   * Download the invoice PDF.
   *
   * The bytes are fetched through the authenticated HttpClient (a plain link
   * would drop the bearer token), then handed to the browser as a blob. The
   * busy flag covers the round trip, so a second click cannot start a second
   * download of the same file.
   */
  protected downloadInvoice(): void {
    const order = this.order();
    if (!order || this.downloadingInvoice()) return;

    this.downloadingInvoice.set(true);

    this.orderService
      .downloadInvoice(order.id, this.plainOrderNumber(), this.language.current())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, filename }) => {
          this.downloadingInvoice.set(false);
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          // The anchor has to be in the document for the click to start the
          // download, and the object URL has to outlive the click — revoking
          // it in the same tick cancels the download in Chromium.
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          setTimeout(() => {
            anchor.remove();
            URL.revokeObjectURL(url);
          }, 0);
        },
        error: (err: unknown) => {
          this.downloadingInvoice.set(false);
          this.notify.apiError(err, 'orders.detail.invoiceFailed', 'The invoice could not be downloaded');
        },
      });
  }

  /**
   * Send the order confirmation again.
   *
   * The toast shows the BACKEND's message (it is already in the reader's
   * language), and only a SENT row is a success: a message the provider refused
   * is a warning, because the customer still has not heard from the store.
   */
  protected resendConfirmation(): void {
    const order = this.order();
    if (!order || this.resendingConfirmation()) return;

    this.resendingConfirmation.set(true);
    this.orderService
      .resendConfirmation(order.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.resendingConfirmation.set(false);
          const status = res.data?.emailStatus;
          if (status === 'SENT') {
            this.notify.apiSuccess(res, 'orders.detail.confirmationSent', 'Confirmation sent');
          } else {
            const backendMessage = typeof res.message === 'string' ? res.message : null;
            this.notify.warningMessage(
              backendMessage,
              'orders.detail.confirmationQueued',
              'The confirmation was not sent yet',
            );
          }
        },
        error: (err: unknown) => {
          this.resendingConfirmation.set(false);
          this.notify.apiError(err, 'orders.detail.confirmationFailed', 'The confirmation could not be sent');
        },
      });
  }

  /** Add an internal note. */
  protected addNote(): void {
    const order = this.order();
    const body = this.noteDraft().trim();
    if (!order || !body || this.savingNote()) return;
    this.savingNote.set(true);
    this.orderService.addNote(order.id, body).subscribe({
      next: () => {
        this.noteDraft.set('');
        this.savingNote.set(false);
        this.resetNoteHeight();
        this.loadActivity(order.id);
        this.notify.success('orders.detail.noteAdded', 'Note added');
      },
      error: (err) => {
        this.savingNote.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not add the note');
      },
    });
  }

  /** Ctrl/Cmd+Enter submits; plain Enter keeps its newline. */
  protected onNoteKeydown(event: KeyboardEvent): void {
    // An IME (Arabic, Japanese, …) uses Enter to commit a candidate; that
    // keypress is not a submit.
    if (event.isComposing) return;
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.addNote();
    }
  }

  /** A textarea that grows with its content, never a scrollbar in a card. */
  protected autoGrow(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  private resetNoteHeight(): void {
    const el = this.noteInput()?.nativeElement;
    if (!el) return;
    el.style.height = 'auto';
  }

  /**
   * Refund the order.
   *
   * <p>The money goes back through the PAYMENT GATEWAY: the backend calls
   * the gateway first and records the refund only when it accepted it. A
   * refusal is shown as it is, and nothing is recorded.
   */
  protected refund(refund: { amount: number; reason: string }): void {
    const order = this.order();
    if (!order) return;
    this.updating.set(true);
    this.orderService.refund(order.id, refund.amount, refund.reason).subscribe({
      next: () => {
        this.updating.set(false);
        this.refundDialogOpen.set(false);
        this.loadOrder(order.id);
        this.loadActivity(order.id);
        this.notify.success('orders.detail.refundRecorded', 'Refund sent to the payment gateway');
      },
      error: (err) => {
        this.updating.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'The refund was refused');
      },
    });
  }

  /** Record (or change) the shipment. */
  protected saveShipment(draft: ShipmentDraft): void {
    const order = this.order();
    if (!order) return;
    this.updating.set(true);
    // The dialog speaks LOCAL time (a `datetime-local` value); the API
    // speaks ISO instants. An empty field clears the ETA.
    const estimatedDeliveryAt = draft.estimatedDeliveryAt
      ? new Date(draft.estimatedDeliveryAt).toISOString()
      : null;
    this.orderService
      .updateShipment(order.id, { ...draft, estimatedDeliveryAt })
      .subscribe({
        next: (res) => {
          this.shipment.set(res.data);
          this.updating.set(false);
          this.shipmentDialogOpen.set(false);
          this.notify.success('orders.detail.shipmentSaved', 'Shipment saved');
        },
        error: (err) => {
          this.updating.set(false);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not save the shipment');
        },
      });
  }

  // ── returns (FE-20) ──────────────────────────────────────────────────────

  protected openReturnDialog(): void {
    if (!this.canHaveReturns() || !this.hasReturnableLines()) return;
    this.returnDialogOpen.set(true);
  }

  protected closeReturnDialog(): void {
    this.returnDialogOpen.set(false);
  }

  /**
   * Record a return.
   *
   * <p>Recording does not move stock: the returns list, the timeline and the
   * stock figure are refreshed from the server rather than patched locally.
   */
  protected createReturn(payload: CreateReturnPayload): void {
    const order = this.order();
    if (!order || this.savingReturn()) return;
    this.savingReturn.set(true);
    this.orderService.createReturn(order.id, payload).subscribe({
      next: () => {
        this.savingReturn.set(false);
        this.returnDialogOpen.set(false);
        this.refreshAfterReturnChange(order.id);
        this.notify.success('orders.returns.created', 'Return recorded');
      },
      error: (err: unknown) => {
        this.savingReturn.set(false);
        this.notify.apiError(err, 'orders.returns.createFailed', 'The return could not be recorded');
      },
    });
  }

  /** Open the confirm for a decision, stating what it will do. */
  protected askDecision(ret: OrderReturn, mode: 'approve' | 'reject'): void {
    if (!this.canDecide(ret)) return;
    this.decisionTarget.set(ret);
    this.decisionMode.set(mode);
    this.decisionDialogOpen.set(true);
  }

  protected closeDecisionDialog(): void {
    this.decisionDialogOpen.set(false);
    this.decisionTarget.set(null);
  }

  /**
   * Approve or reject.
   *
   * <p>Approving restocks the units through the backend's stock log; the page
   * then re-reads the returns, the timeline and the catalog stock, so what is
   * on screen is what the server did — never a locally assumed number.
   */
  protected applyDecision(): void {
    const order = this.order();
    const target = this.decisionTarget();
    if (!order || !target || this.decidingReturn()) return;

    const mode = this.decisionMode();
    this.decidingReturn.set(true);
    this.orderService.decideReturn(order.id, target.id, mode).subscribe({
      next: () => {
        this.decidingReturn.set(false);
        this.decisionDialogOpen.set(false);
        this.decisionTarget.set(null);
        this.refreshAfterReturnChange(order.id);
        this.notify.success(
          mode === 'approve' ? 'orders.returns.approved' : 'orders.returns.rejected',
          mode === 'approve' ? 'Return approved and restocked' : 'Return rejected',
        );
      },
      error: (err: unknown) => {
        this.decidingReturn.set(false);
        this.notify.apiError(err, 'orders.returns.decisionFailed', 'The decision could not be saved');
      },
    });
  }

  /**
   * What a return decision changed: the returns, the timeline and the stock.
   *
   * <p>The stock read is the catalog's variant figure (`getBySlug`), which the
   * page already holds — re-reading it is what makes "in stock" on the return
   * line the number the approval produced.
   */
  private refreshAfterReturnChange(orderId: number): void {
    this.loadReturns(orderId);
    this.loadActivity(orderId);
    const order = this.order();
    if (order) this.loadVariants(order);
  }

  /** The backend's own sentence from an error body, when it has one. */
  private apiMessage(err: unknown): string | null {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    return typeof message === 'string' && message.trim().length > 0 ? message : null;
  }

  /** Retry the returns read — the error state's one action. */
  protected retryReturns(): void {
    if (this.currentId > 0) this.loadReturns(this.currentId);
  }

  // ── the clipboard ────────────────────────────────────────────────────────

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
    await this.copy(text, 'orders.detail.addressCopied', 'Address copied');
  }

  protected async copyReference(): Promise<void> {
    const reference = this.payment()?.transactionReference;
    if (!reference) return;
    await this.copy(reference, 'orders.detail.referenceCopied', 'Transaction reference copied');
  }

  protected async copyTracking(): Promise<void> {
    const tracking = this.shipment()?.trackingNumber;
    if (!tracking) return;
    await this.copy(tracking, 'orders.detail.trackingCopied', 'Tracking number copied');
  }

  protected async copyOrderNumber(): Promise<void> {
    const number = this.plainOrderNumber();
    if (!number) return;
    await this.copy(number, 'orders.actions.copied', 'Order number copied');
  }

  protected async copyLink(): Promise<void> {
    const order = this.order();
    if (!order) return;
    const url = `${window.location.origin}/dashboard/orders/${order.id}`;
    await this.copy(url, 'orders.detail.linkCopied', 'Order link copied');
  }

  private async copy(text: string, successKey: string, fallback: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notify.success(successKey, fallback);
    } catch {
      this.notify.apiError(null, 'notify.errorFallback', 'Could not copy to the clipboard');
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

  /** The order number, plain (for a `title` attribute or the clipboard). */
  protected plainOrderNumber(): string {
    return formatOrderNumber(this.order()?.orderNumber, this.order()?.id);
  }

  protected statusKind(status: OrderStatus) {
    return orderStatusKind(status);
  }

  protected paymentKind(status: PaymentStatus) {
    return paymentStatusKind(status);
  }

  /**
   * "Giza" — the city and governorate, deduplicated.
   *
   * <p>The seed stores `city = state = "Giza"`, and printing both produced
   * "Giza, Giza". The two are shown once when they are the same place.
   */
  protected cityLine(): string {
    const address = this.order()?.address;
    if (!address) return '';
    const parts = [address.city, address.state].filter((part): part is string => !!part?.trim());
    const unique = parts.filter(
      (part, index) =>
        parts.findIndex((other) => other.trim().toLowerCase() === part.trim().toLowerCase()) === index,
    );
    const base = unique.join(', ');
    const postal = address.postalCode?.trim();
    return postal ? `${base} ${postal}`.trim() : base;
  }

  /** Country only — postal code now travels with the city line. */
  protected countryLine(): string {
    const address = this.order()?.address;
    if (!address) return '';
    return address.country?.trim() ?? '';
  }

  /** The recipient's name on the address card. */
  protected addressName(): string | null {
    const name = this.order()?.address?.fullName?.trim();
    return name ? name : null;
  }

  /** Map a raw actor id (e.g. "seed") to a human label. */
  protected actorName(actor: string): string {
    const value = actor.trim().toLowerCase();
    if (value === 'seed' || value.startsWith('system')) return this.t('orders.timeline.system', 'System');
    return actor;
  }

  /** The phone on the address card. */
  protected addressPhone(): string | null {
    const phone = this.order()?.address?.phone?.trim();
    return phone ? phone : null;
  }

  /** "Cash on delivery" and whether the cash was collected. */
  protected isCashOnDelivery(): boolean {
    return this.order()?.paymentMethod === 'CASH_ON_DELIVERY';
  }

  protected paymentMethodLabel(): string {
    return this.names.paymentMethod(this.order()?.paymentMethod ?? '');
  }

  /** The one-line settlement value: an amount, or the honest "not recorded". */
  protected notRecorded(): string {
    return this.t('orders.detail.notRecorded', 'Not recorded');
  }

  protected refundLines(): OrderRefund[] {
    return this.payment()?.refunds ?? [];
  }

  // ── activity titles ──────────────────────────────────────────────────────

  private eventIcon(event: OrderEvent): string {
    switch (event.kind) {
      case 'placed':
        return 'lucideCheckCircle';
      case 'status':
        return 'lucideHistory';
      case 'payment':
        return 'lucideBanknote';
      case 'shipment':
        return 'lucideTruck';
      case 'refund':
        return 'lucideRotateCcw';
      case 'return':
        return 'lucideUndo2';
      case 'note':
        return 'lucideStickyNote';
      case 'email':
        return 'lucideMail';
      default:
        return 'lucideInfo';
    }
  }

  private eventTitle(event: OrderEvent): string {
    switch (event.kind) {
      case 'placed':
        return this.t('orders.timeline.placed', 'Order placed');
      case 'status': {
        if (!event.fromStatus) return this.t('orders.timeline.placed', 'Order placed');
        const from = this.names.orderStatus(event.fromStatus);
        const to = this.names.orderStatus(event.toStatus ?? event.fromStatus);
        return this.t('orders.timeline.statusChangedFrom', '{{from}} → {{to}}', { from, to });
      }
      case 'payment':
        return this.t('orders.timeline.payment', 'Payment received');
      case 'shipment':
        return event.shipmentStage === 'delivered'
          ? this.t('orders.timeline.shipmentDelivered', 'Shipment delivered')
          : this.t('orders.timeline.shipmentShipped', 'Shipment handed to the carrier');
      case 'refund':
        return this.t('orders.timeline.refund', 'Refund issued');
      case 'return':
        return this.returnEventTitle(event.returnEvent);
      case 'note':
        return this.t('orders.timeline.note', 'Note added');
      case 'email':
        return this.t('orders.timeline.email', 'Email sent');
      default:
        return this.t('orders.timeline.event', 'Activity');
    }
  }

  /**
   * The title of a RETURN event on the timeline.
   *
   * <p>`returnEvent` is the backend's own event name (`RETURN_REQUESTED` …),
   * so the row says what happened without the page re-deriving it from the
   * return's status — a return can be rejected after being requested, and the
   * timeline keeps BOTH rows.
   */
  private returnEventTitle(event: string | undefined): string {
    switch (event) {
      case 'RETURN_APPROVED':
        return this.t('orders.timeline.returnApproved', 'Return approved — units restocked');
      case 'RETURN_REJECTED':
        return this.t('orders.timeline.returnRejected', 'Return rejected');
      case 'RETURN_REQUESTED':
        return this.t('orders.timeline.returnRequested', 'Return requested');
      default:
        return this.t('orders.timeline.returnEvent', 'Return updated');
    }
  }

  /** Translate with an English fallback and optional params — never a raw key. */
  protected t(key: string, fallback: string, params?: Record<string, unknown>): string {
    // Read the active language so every computed that calls `t()` (disabled
    // reasons, event titles) is recomputed when the admin switches language.
    this.transloco.activeLang();
    const value = this.transloco.translate(key, params);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }
}