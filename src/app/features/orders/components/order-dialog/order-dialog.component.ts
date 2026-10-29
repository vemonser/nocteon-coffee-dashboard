import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

/**
 * The dialog shell for the order actions.
 *
 * It follows the app's own dialog convention (a conditional overlay with a
 * backdrop, as in the typed-confirm dialog), and adds the three things a
 * dialog must do:
 *
 *  - it TRAPS the focus: Tab cycles inside it and cannot walk out to the
 *    page behind;
 *  - it RESTORES the focus: the control that opened it gets the focus back
 *    when it closes;
 *  - it announces itself: `role="dialog"` + `aria-modal` + a labelled title
 *    and description.
 *
 * Escape closes it, and so does a click on the backdrop — but never a click
 * INSIDE the panel.
 */
@Component({
  selector: 'app-order-dialog',
  standalone: true,
  imports: [HlmButtonImports],
  templateUrl: './order-dialog.component.html',
})
export class OrderDialogComponent {
  readonly open = input<boolean>(false);
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly confirmLabel = input<string>('');
  readonly cancelLabel = input<string>('Cancel');
  readonly confirmDisabled = input<boolean>(false);
  /** The cancel / close control is locked too (a request is in flight). */
  readonly cancelDisabled = input<boolean>(false);
  readonly pending = input<boolean>(false);
  /** A destructive action: the confirm button is destructive. */
  readonly danger = input<boolean>(false);
  /** The test id of the panel, so the evidence harness can find it. */
  readonly testId = input<string>('order-dialog');

  readonly confirmed = output<void>();
  readonly closed = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private lastFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.lastFocused = (document.activeElement as HTMLElement) ?? null;
        // The panel exists only after the @if renders, so the focus lands on
        // the next tick.
        setTimeout(() => this.focusFirst());
      } else if (this.lastFocused) {
        this.lastFocused.focus();
        this.lastFocused = null;
      }
    });
  }

  private focusables(): HTMLElement[] {
    const panel = this.panel()?.nativeElement;
    if (!panel) return [];
    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
  }

  private focusFirst(): void {
    const [first] = this.focusables();
    (first ?? this.panel()?.nativeElement)?.focus();
  }

  /** Keep the Tab key inside the dialog. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusables = this.focusables();
    if (!focusables.length) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && (active === first || !this.panel()?.nativeElement.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
