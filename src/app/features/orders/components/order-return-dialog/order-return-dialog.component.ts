import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { OrderDialogComponent } from '../order-dialog/order-dialog.component';
import type { OrderRefund } from '../../models/order-activity.model';
import { MoneyPipe } from '../../../../shared/pipes/money.pipe';

/** One order line, with what is still returnable on it. */
export interface ReturnableLine {
  id: number;
  productName: string | null;
  sku: string;
  ordered: number;
  /** Units an earlier, non-rejected return already brought back. */
  returned: number;
  /** What is left to return: `ordered - returned`. */
  available: number;
}

/** What the dialog sends back. */
export interface ReturnDraft {
  reason: string;
  refundId: number | null;
  items: Array<{ orderItemId: number; quantity: number; note: string | null }>;
}

/**
 * The "Create return" dialog (FE-20).
 *
 * <p>It records GOODS, not money: the lines that came back, how many of each
 * and why. Recording moves no stock — approving does, and the dialog says so
 * instead of letting an admin believe the shelf already changed.
 *
 * <p>The quantity is capped by what is still returnable on the line
 * (`ordered - already returned`), computed by the page from the returns it has
 * already read; the server enforces the same sum, so the cap is a courtesy,
 * never the rule.
 *
 * <p>The refund is OPTIONAL and chosen from the refunds the store already
 * recorded for this order — a return does not create money movement of its own.
 */
@Component({
  selector: 'app-order-return-dialog',
  standalone: true,
  imports: [
    FormsModule,
    HlmButtonImports,
    HlmCheckboxImports,
    HlmInputImports,
    MoneyPipe,
    OrderDialogComponent,
    TranslocoPipe,
  ],
  templateUrl: './order-return-dialog.component.html',
})
export class OrderReturnDialogComponent {
  private readonly transloco = inject(TranslocoService);

  readonly open = input<boolean>(false);
  readonly lines = input<readonly ReturnableLine[]>([]);
  /** The refunds already recorded for this order, oldest first. */
  readonly refunds = input<readonly OrderRefund[]>([]);
  readonly pending = input<boolean>(false);

  readonly confirmed = output<ReturnDraft>();
  readonly closed = output<void>();

  /** Which rows are ticked. A row is included only when its quantity is valid. */
  protected readonly selected = signal<Readonly<Record<number, boolean>>>({});
  /** The quantity typed per row, as a string (the input's own value). */
  protected readonly quantities = signal<Readonly<Record<number, string>>>({});
  /** The optional per-line remark ("bag torn", "wrong grind"). */
  protected readonly notes = signal<Readonly<Record<number, string>>>({});
  /** A row's quantity is only criticised after it was left or a submit tried. */
  protected readonly touched = signal<Readonly<Record<number, boolean>>>({});
  protected readonly submitted = signal(false);

  protected readonly reason = signal('');
  /** The linked refund, or null when the return is not paid back by one. */
  protected readonly refundId = signal<number | null>(null);

  protected readonly title = computed(() => this.t('orders.returns.dialog.title', 'Create return'));
  protected readonly description = computed(() =>
    this.t(
      'orders.returns.dialog.description',
      'Record what came back — the stock moves only when the return is approved.',
    ),
  );
  protected readonly confirmLabel = computed(() =>
    this.t('orders.returns.dialog.confirm', 'Create return'),
  );
  protected readonly cancelLabel = computed(() => this.t('common.cancel', 'Cancel'));
  protected readonly reasonLabel = computed(() =>
    this.t('orders.returns.dialog.reason', 'Why did it come back?'),
  );
  protected readonly reasonPlaceholder = computed(() =>
    this.t('orders.returns.dialog.reasonPlaceholder', 'Damaged on arrival, wrong grind, …'),
  );
  protected readonly linesLabel = computed(() =>
    this.t('orders.returns.dialog.lines', 'Lines coming back'),
  );
  protected readonly refundLabel = computed(() =>
    this.t('orders.returns.dialog.refund', 'Refund (optional)'),
  );
  protected readonly refundNone = computed(() =>
    this.t('orders.returns.dialog.noRefund', 'No refund'),
  );
  protected readonly refundHint = computed(() =>
    this.t(
      'orders.returns.dialog.refundHint',
      'Link a refund the store already recorded for this order. A return never creates one.',
    ),
  );
  protected readonly orderedLabel = computed(() => this.t('orders.returns.dialog.ordered', 'Ordered'));
  protected readonly returnedLabel = computed(() =>
    this.t('orders.returns.dialog.alreadyReturned', 'Already returned'),
  );
  protected readonly quantityLabel = computed(() =>
    this.t('orders.returns.dialog.quantity', 'Quantity'),
  );
  protected readonly noteLabel = computed(() => this.t('orders.returns.dialog.note', 'Note (optional)'));
  protected readonly overLimit = computed(() =>
    this.t('orders.returns.dialog.overLimit', 'More than the units left on this line.'),
  );
  protected readonly reasonRequired = computed(() =>
    this.t('orders.returns.dialog.reasonRequired', 'A return needs a reason.'),
  );
  protected readonly lineRequired = computed(() =>
    this.t('orders.returns.dialog.lineRequired', 'Tick at least one line and enter how many.'),
  );

  constructor() {
    // A dialog opens empty: nothing ticked, no reason, no refund link. A
    // previous attempt must never travel into the next one.
    effect(() => {
      if (!this.open()) return;
      this.selected.set({});
      this.quantities.set({});
      this.notes.set({});
      this.touched.set({});
      this.submitted.set(false);
      this.reason.set('');
      this.refundId.set(null);
    });
  }

  /** How many units of a line are still returnable. */
  protected available(line: ReturnableLine): number {
    return Math.max(0, line.available);
  }

  /** The quantity typed for a row, as a number (0 when empty or nonsense). */
  protected quantityOf(line: ReturnableLine): number {
    const raw = this.quantities()[line.id] ?? '';
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  protected isSelected(line: ReturnableLine): boolean {
    return this.selected()[line.id] === true;
  }

  protected toggle(line: ReturnableLine, checked: boolean): void {
    this.selected.set({ ...this.selected(), [line.id]: checked });
    if (checked && !this.quantities()[line.id]) {
      // Start at one unit: the common case is "one came back", and a zero
      // would have to be corrected before the form is valid.
      this.quantities.set({ ...this.quantities(), [line.id]: '1' });
    }
  }

  protected setQuantity(line: ReturnableLine, value: string): void {
    this.quantities.set({ ...this.quantities(), [line.id]: value });
  }

  protected setNote(line: ReturnableLine, value: string): void {
    this.notes.set({ ...this.notes(), [line.id]: value });
  }

  protected markTouched(line: ReturnableLine): void {
    this.touched.set({ ...this.touched(), [line.id]: true });
  }

  /** Show a row's quantity error only after the field was left or a submit tried. */
  protected showQuantityError(line: ReturnableLine): boolean {
    if (!this.isSelected(line)) return false;
    if (!this.touched()[line.id] && !this.submitted()) return false;
    const quantity = this.quantityOf(line);
    return quantity < 1 || quantity > this.available(line);
  }

  /** The rows that will be sent: ticked, with a valid quantity. */
  protected readonly chosen = computed(() =>
    this.lines().filter((line) => {
      if (!this.isSelected(line)) return false;
      const quantity = this.quantityOf(line);
      return quantity >= 1 && quantity <= this.available(line);
    }),
  );

  protected readonly canConfirm = computed(
    () => this.reason().trim().length > 0 && this.chosen().length > 0,
  );

  protected submit(): void {
    this.submitted.set(true);
    if (!this.canConfirm()) return;
    this.confirmed.emit({
      reason: this.reason().trim(),
      refundId: this.refundId(),
      items: this.chosen().map((line) => ({
        orderItemId: line.id,
        quantity: this.quantityOf(line),
        note: (this.notes()[line.id] ?? '').trim() || null,
      })),
    });
  }

  protected pickRefund(id: number | null): void {
    this.refundId.set(id);
  }

  private t(key: string, fallback: string, params?: Record<string, unknown>): string {
    // Read the active language: `translate()` is not a signal read, and a
    // runtime switch must re-render the dialog's copy too.
    this.transloco.activeLang();
    const value = this.transloco.translate(key, params);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }
}
