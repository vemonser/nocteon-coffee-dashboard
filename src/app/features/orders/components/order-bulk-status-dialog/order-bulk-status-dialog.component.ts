import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { Dir } from '@angular/cdk/bidi';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmRadioGroupImports } from '@spartan-ng/helm/radio-group';
import { OrderDialogComponent } from '../order-dialog/order-dialog.component';
import { PluralPipe } from '../../../../shared/pipes/plural.pipe';
import { LanguageService } from '../../../../core/i18n/language.service';
import { countMessage } from '../../../../core/i18n/plural';
import type { OrderStatus } from '../../models/order.model';
import { bulkStatusChoices, eligibleRows, type BulkStatusRow } from '../../utils/bulk-status';

/**
 * The bulk "Change status" dialog (FE-18).
 *
 * <p>It picks ONE target status for the whole selection and applies it to the
 * rows that can actually take it. Nothing is sent from here — the list owns
 * the per-order requests — so the dialog can be opened, read and cancelled
 * with no side effect.
 *
 * <p>The statuses come from the shared vocabulary and the shared transition
 * map: a status nobody can reach is still LISTED, disabled and explained,
 * which is more use than hiding half the vocabulary from the reader.
 * `CANCELLED` is not offered at all — it needs one reason per order, so it
 * keeps its own dialog.
 */
@Component({
  selector: 'app-order-bulk-status-dialog',
  standalone: true,
  imports: [Dir, TranslocoPipe, PluralPipe, HlmRadioGroupImports, OrderDialogComponent],
  templateUrl: './order-bulk-status-dialog.component.html',
})
export class OrderBulkStatusDialogComponent {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);

  readonly open = input<boolean>(false);
  /** The selected rows: the dialog decides what is possible from their statuses. */
  readonly rows = input<readonly BulkStatusRow[]>([]);
  /** A run is in flight: the buttons lock and the progress line shows. */
  readonly pending = input<boolean>(false);
  /** How far the run has got, one order at a time. */
  readonly progress = input<{ done: number; total: number } | null>(null);

  readonly confirmed = output<OrderStatus>();
  readonly closed = output<void>();

  /** The status the admin picked. */
  protected readonly selected = signal<OrderStatus | null>(null);

  protected readonly choices = computed(() => bulkStatusChoices(this.rows()));

  /** Rows the chosen status would actually change. */
  protected readonly targetCount = computed(() => {
    const status = this.selected();
    return status ? eligibleRows(this.rows(), status).length : 0;
  });

  protected readonly anyOption = computed(() => this.choices().some((choice) => choice.enabled));

  /**
   * The direction of the radio group.
   *
   * The app flips `html[dir]`; the radio group reads its direction from CDK's
   * `Directionality`, so it is told explicitly — otherwise the arrow keys map
   * left/right the LTR way and the group feels mirrored in Arabic.
   */
  protected readonly direction = computed(() =>
    this.language.current() === 'ar' ? 'rtl' : 'ltr',
  );

  protected readonly title = computed(() => this.t('orders.bulk.changeStatus', 'Change status'));

  protected readonly description = computed(() =>
    this.t(
      'orders.bulk.dialog.description',
      'Each order is updated one at a time, and only to a status its current one allows.',
    ),
  );

  protected readonly selectLabel = computed(() =>
    this.t('orders.bulk.dialog.selectLabel', 'New status'),
  );

  protected readonly hint = computed(() =>
    this.t(
      'orders.bulk.dialog.hint',
      'Orders that cannot take this status are skipped, and any failure is listed afterwards.',
    ),
  );

  protected readonly cancelNote = computed(() =>
    this.t(
      'orders.bulk.dialog.cancelNote',
      'Cancelling stays with each order — it needs a reason.',
    ),
  );

  protected readonly noOptions = computed(() =>
    this.t(
      'orders.bulk.dialog.noOptions',
      'None of the selected orders can change status — they are already delivered or cancelled.',
    ),
  );

  protected readonly cancelLabel = computed(() => this.t('common.cancel', 'Cancel'));

  /**
   * The primary button names what it will do, with the number it will touch:
   * "Update 8 orders" (or the plain action while nothing is picked).
   */
  protected readonly confirmLabel = computed(() => {
    if (!this.selected()) return this.t('orders.dialogs.status.confirm', 'Update status');
    return this.plural('orders.bulk.updateCount', this.targetCount());
  });

  protected readonly canConfirm = computed(
    () => this.selected() !== null && this.targetCount() > 0 && !this.pending(),
  );

  protected readonly progressLabel = computed(() => {
    const progress = this.progress();
    if (!progress) return '';
    return this.t('orders.bulk.progress', 'Updating…', {
      done: progress.done,
      total: progress.total,
    });
  });

  /** Each opening starts clean: no status left from the last run. */
  constructor() {
    effect(() => {
      if (this.open()) this.selected.set(null);
    });
  }

  protected statusName(status: OrderStatus): string {
    return this.t(`orders.statuses.${status}`, status);
  }

  /** A radio change — accepted only for a status the selection can reach. */
  protected pick(value: unknown): void {
    const status = value as OrderStatus;
    const choice = this.choices().find((entry) => entry.status === status);
    if (!choice?.enabled) return;
    this.selected.set(status);
  }

  protected confirm(): void {
    const status = this.selected();
    if (!status || this.pending() || this.targetCount() === 0) return;
    this.confirmed.emit(status);
  }

  protected close(): void {
    // A run in flight is not cancellable: closing would hide the only place
    // that shows its progress, while the requests keep going.
    if (this.pending()) return;
    this.closed.emit();
  }

  private t(key: string, fallback: string, params?: Record<string, unknown>): string {
    // Read the active language so every computed that calls `t()` recomputes
    // when the admin switches language at runtime. `translate()` alone is not
    // a signal read.
    this.transloco.activeLang();
    const value = this.transloco.translate(key, params);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }

  /** A count in the grammar of the active language (the same lookup the pipe uses). */
  private plural(base: string, count: number): string {
    this.transloco.activeLang();
    return countMessage(
      (key, values) => this.transloco.translate(key, values),
      this.language.language(),
      base,
      count,
    );
  }
}
