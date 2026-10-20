import {
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * The side panel — the panel that opens at the INLINE END.
 *
 * It follows the app's dialog convention (a conditional overlay with a
 * backdrop) and adds the three things a panel must do:
 *
 *  - it TRAPS the focus: Tab cycles inside it and cannot walk out to the
 *    page behind;
 *  - it RESTORES the focus: the control that opened it gets the focus back
 *    when it closes;
 *  - it announces itself: `role="dialog"` + `aria-modal` + a labelled title.
 *
 * Escape closes it, and so does a click on the backdrop — but never a click
 * INSIDE the panel.
 *
 * The panel sits on the INLINE END, not on the right: a physical side would
 * be wrong in one of the two languages.
 */
@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [CommonModule, HlmButtonImports, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideX })],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
        (click)="onBackdrop($event)"
        (keydown)="onKeydown($event)"
      >
        <aside
          #panel
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          tabindex="-1"
          class="flex h-full w-full max-w-md flex-col border-s bg-card shadow-2xl outline-none"
        >
          <header class="flex items-start justify-between gap-4 border-b p-6">
            <h2 class="text-lg font-medium">{{ title() }}</h2>
            <button
              type="button"
              hlmBtn
              variant="ghost"
              size="icon"
              (click)="closed.emit()"
              [attr.aria-label]="'common.close' | transloco"
            >
              <ng-icon name="lucideX" class="size-4" />
            </button>
          </header>
          <div class="min-h-0 flex-1 overflow-y-auto p-6">
            <ng-content />
          </div>
        </aside>
      </div>
    }
  `,
})
export class SidePanelComponent {
  readonly open = input(false);
  readonly title = input.required<string>();

  readonly closed = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private lastFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.lastFocused = (document.activeElement as HTMLElement) ?? null;
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

  /** Keep the Tab key inside the panel. */
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
