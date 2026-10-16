import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Type-to-confirm for irreversible actions.
 *
 * The user must reproduce the slug (or name) exactly; the confirm button stays
 * disabled until it matches, and a mismatch is reported inline next to the field
 * rather than in a toast, so the message sits where the mistake is.
 *
 * Used for permanent delete. NOTE: the backend exposes no permanent-delete endpoint
 * yet (see `core/crud/soft-delete.contract.ts`) — this dialog is complete and will
 * work as soon as the route exists; until then the caller surfaces the gap.
 */
@Component({
  selector: 'app-confirm-typed-dialog',
  standalone: true,
  imports: [FormsModule, HlmButtonImports, HlmInputImports, TranslocoPipe],
  templateUrl: './confirm-typed-dialog.component.html',
})
export class ConfirmTypedDialogComponent {
  readonly open = input.required<boolean>();
  /** The value the user must reproduce (slug or name). */
  readonly expected = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly typedLabel = input.required<string>();
  readonly mismatchMessage = input.required<string>();
  readonly pending = input<boolean>(false);
  /** Extra notice rendered above the input, e.g. an API limitation. */
  readonly notice = input<string>('');

  readonly confirmed = output<string>();
  readonly closed = output<void>();

  /** Typed value. Named `typed` because `input` is Angular's signal-input API. */
  readonly typed = signal('');

  private readonly typedInput = viewChild<ElementRef<HTMLInputElement>>('typedInput');

  /** Trimmed comparison: trailing whitespace in a slug is a typo, not intent. */
  readonly matches = computed(
    () => this.typed().trim().length > 0 && this.typed().trim() === this.expected().trim(),
  );
  readonly showMismatch = computed(() => this.typed().trim().length > 0 && !this.matches());

  constructor() {
    // Clear on open so a previous attempt never carries over, and move focus into the
    // field. The timeout lands after the @if block has rendered the input.
    effect(() => {
      if (this.open()) {
        this.typed.set('');
        setTimeout(() => this.typedInput()?.nativeElement.focus());
      }
    });
  }

  onInput(value: string): void {
    this.typed.set(value);
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  onConfirm(): void {
    if (!this.matches() || this.pending()) return;
    this.confirmed.emit(this.typed().trim());
  }
}