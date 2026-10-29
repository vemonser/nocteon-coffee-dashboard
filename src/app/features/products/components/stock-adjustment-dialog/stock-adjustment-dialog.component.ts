import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2 } from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { DialogShellComponent } from '../../../../shared/ui/dialog-shell/dialog-shell.component';
import { canAdjust, parseDelta, previewStock } from '../../utils/stock-adjustment';

/** What the dialog asks the server for: a change, and the reason for it. */
export interface StockAdjustmentDraft {
  delta: number;
  reason: string;
}

/**
 * Change a variant's stock, with the reason the log needs.
 *
 * <p>The reason is not decoration: the backend refuses a blank one with a 400,
 * because a row saying "12 → 9" with no explanation is exactly what the movement
 * log exists to prevent. So the field is required here too, and the error shows
 * only after the field was touched or the form was submitted — never while the
 * admin is still typing.
 *
 * <p>The number is a DELTA ("remove 3"), not the new total: "+24 arrived" and
 * "corrected 12 down to 9" are different sentences in the history, and only the
 * admin knows which one they mean.
 */
@Component({
  selector: 'app-stock-adjustment-dialog',
  standalone: true,
  imports: [
    DialogShellComponent,
    ReactiveFormsModule,
    HlmButtonImports,
    HlmInputImports,
    HlmLabel,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [provideIcons({ lucideLoader2 })],
  template: `
    <app-dialog-shell
      [open]="open()"
      [title]="'products.variants.history.adjustTitle' | transloco"
      [subtitle]="subtitle()"
      testId="stock-adjustment-dialog"
      (closed)="close()"
    >
      <form [formGroup]="form" class="flex flex-col gap-4" (ngSubmit)="save()">
        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="stock-adjustment-delta">
            {{ 'products.variants.history.delta' | transloco }} *
          </label>
          <input
            id="stock-adjustment-delta"
            hlmInput
            type="number"
            step="1"
            dir="ltr"
            formControlName="delta"
            class="w-full"
            data-testid="stock-adjustment-delta"
          />
          <p
            class="text-xs"
            [class.text-destructive]="showDeltaError()"
            [class.text-muted-foreground]="!showDeltaError()"
            data-testid="stock-adjustment-delta-hint"
          >
            {{
              (showDeltaError()
                ? 'products.variants.history.deltaInvalid'
                : 'products.variants.history.deltaHint'
              ) | transloco
            }}
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <label hlmLabel for="stock-adjustment-reason">
            {{ 'products.variants.history.reason' | transloco }} *
          </label>
          <input
            id="stock-adjustment-reason"
            hlmInput
            type="text"
            dir="auto"
            autocomplete="off"
            formControlName="reason"
            class="w-full"
            [placeholder]="'products.variants.history.reasonPlaceholder' | transloco"
            data-testid="stock-adjustment-reason"
          />
          @if (showReasonError()) {
            <p class="text-xs text-destructive" data-testid="stock-adjustment-reason-error">
              {{ 'products.variants.history.reasonRequired' | transloco }}
            </p>
          }
        </div>

        @if (nextStock(); as next) {
          <p class="rounded-md bg-muted/40 px-3 py-2 text-sm" data-testid="stock-adjustment-preview">
            {{ 'products.variants.history.preview' | transloco: { before: stock(), after: next } }}
          </p>
        }
      </form>

      <button dialog-footer-start hlmBtn variant="ghost" type="button" (click)="close()">
        {{ 'common.cancel' | transloco }}
      </button>

      <button
        dialog-footer-end
        hlmBtn
        type="button"
        data-testid="stock-adjustment-save"
        [disabled]="!canSave()"
        (click)="save()"
      >
        @if (pending()) {
          <ng-icon name="lucideLoader2" class="me-2 size-4 animate-spin" aria-hidden="true" />
        }
        {{ 'products.variants.history.adjust' | transloco }}
      </button>
    </app-dialog-shell>
  `,
})
export class StockAdjustmentDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input<boolean>(false);
  /** The SKU, so the dialog says which variant is about to change. */
  readonly sku = input<string>('');
  /** The stock the panel shows, for the preview and the "never below 0" rule. */
  readonly stock = input<number>(0);
  readonly pending = input<boolean>(false);

  readonly saved = output<StockAdjustmentDraft>();
  readonly closed = output<void>();

  protected readonly form = this.fb.group({
    delta: this.fb.control<number | null>(null, [Validators.required]),
    reason: this.fb.nonNullable.control('', [Validators.required]),
  });

  /** The live values, so the preview updates as the admin types. */
  private readonly delta = signal<number | null>(null);
  /** Set by a submit attempt: from then on, errors show before the first blur. */
  private readonly submitted = signal(false);

  protected readonly subtitle = computed(() =>
    this.transloco.translate('products.variants.history.adjustSubtitle', {
      sku: this.sku() || '—',
      count: this.stock(),
    }),
  );

  /** The stock the change would leave behind, or null when it is not usable. */
  protected readonly nextStock = computed(() => previewStock(this.stock(), this.delta()));

  protected readonly showDeltaError = computed(
    () => (this.form.controls.delta.touched || this.submitted()) && !this.canSave(),
  );

  protected readonly showReasonError = computed(
    () =>
      (this.form.controls.reason.touched || this.submitted()) &&
      String(this.form.controls.reason.value ?? '').trim().length === 0,
  );

  protected readonly canSave = computed(() =>
    canAdjust(this.stock(), this.delta(), String(this.form.controls.reason.value ?? ''), this.pending()),
  );

  constructor() {
    this.form.controls.delta.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.delta.set(parseDelta(value)));

    // Every open starts from a clean form: a stale reason from the last variant
    // must not be sent for this one.
    effect(() => {
      if (!this.open()) return;
      this.submitted.set(false);
      this.form.reset({ delta: null, reason: '' });
      this.delta.set(null);
    });
  }

  protected save(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (!this.canSave()) return;
    this.saved.emit({
      delta: Number(this.delta()),
      reason: String(this.form.controls.reason.value).trim(),
    });
  }

  protected close(): void {
    this.closed.emit();
  }
}
