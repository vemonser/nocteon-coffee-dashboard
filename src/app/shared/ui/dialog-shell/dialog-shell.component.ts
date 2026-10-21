import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-dialog-shell',
  standalone: true,
  imports: [HlmButtonImports, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideX })],
  template: `
    @if (open()) {
      <div
        [class]="backdropClass()"
        (click)="onBackdrop($event)"
      >
        <div
          #panel
          [attr.role]="panelRole()"
          aria-modal="true"
          [attr.aria-describedby]="describedBy() || null"
          [attr.inert]="inert() ? '' : null"
          tabindex="-1"
          [attr.data-testid]="testId()"
          [attr.aria-labelledby]="testId() + '-title'"
          [class]="panelClass()"
        >
          <header class="flex items-start justify-between gap-3 border-b px-6 py-4">
            <div class="min-w-0">
              <h2 [id]="testId() + '-title'" class="text-lg font-medium">{{ title() }}</h2>
              @if (subtitle()) {
                <p class="mt-1 text-sm text-muted-foreground">{{ subtitle() }}</p>
              }
            </div>
            <button
              type="button"
              hlmBtn
              variant="ghost"
              size="icon"
              class="shrink-0"
              (click)="closed.emit()"
              [attr.aria-label]="'common.close' | transloco"
            >
              <ng-icon name="lucideX" class="size-4" aria-hidden="true" />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <ng-content></ng-content>
          </div>

          <footer class="flex items-center justify-between gap-3 border-t px-6 py-4">
            <div class="flex items-center gap-2">
              <ng-content select="[dialog-footer-start]"></ng-content>
            </div>
            <div class="flex items-center gap-2">
              <ng-content select="[dialog-footer-end]"></ng-content>
            </div>
          </footer>
        </div>
      </div>
    }
  `,
})
export class DialogShellComponent {
  readonly open = input<boolean>(false);
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly testId = input<string>('dialog-shell');

  /**
   * The dialog is a FULL-WIDTH SHEET on a phone, and a centred card from
   * `sm` up. The body scrolls and the footer stays put, so the actions are
   * always reachable — a phone dialog that grows with its content pushes the
   * actions off the screen, and the actions are the reason it is open.
   */
  readonly mobileSheet = input<boolean>(false);

  /**
   * The role of the panel. A confirmation that destroys something is an
   * `alertdialog`, not a `dialog`: the difference is what a screen reader
   * announces when the panel opens.
   */
  readonly panelRole = input<'dialog' | 'alertdialog'>('dialog');

  /**
   * The id of the element that DESCRIBES the panel — the sentence that says
   * what will happen. An `alertdialog` exists for exactly that sentence, so
   * it is announced with the question and not after it.
   */
  readonly describedBy = input<string>('');

  /**
   * The panel is inert: it cannot be focused, and a screen reader skips it.
   *
   * <p>Used when a SECOND dialog is open on top of this one: two panels
   * that both claim `aria-modal` contradict each other, and the buttons of
   * the background dialog (an "Approve", behind a "delete?") must not be
   * reachable while the confirmation is up.
   */
  readonly inert = input<boolean>(false);

  readonly closed = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private lastFocused: HTMLElement | null = null;

  /**
   * The scrim. On a phone the sheet reaches the edges of the screen, so the
   * padding that frames the card is dropped below `sm`.
   */
  protected readonly backdropClass = computed(() =>
    this.mobileSheet()
      ? 'fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm sm:p-4'
      : 'fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm',
  );

  /** The panel: a full-height sheet on a phone, a centred card above it. */
  protected readonly panelClass = computed(() =>
    this.mobileSheet()
      ? 'flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col border bg-card shadow-2xl outline-none sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-[var(--radius-card)]'
      : 'flex w-full max-w-lg max-h-[90vh] flex-col rounded-[var(--radius-card)] border bg-card shadow-2xl outline-none',
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        this.lastFocused = (document.activeElement as HTMLElement) ?? null;
        setTimeout(() => this.focusFirst());
        // The keys are handled on the DOCUMENT, not on the panel: a control
        // that becomes disabled (the approve button while its request is in
        // flight) drops the focus to the body, and a key pressed there
        // never reaches the panel — so Escape would stop working exactly
        // when the admin is waiting for the app.
        document.addEventListener('keydown', this.onKeydown, true);
      } else {
        document.removeEventListener('keydown', this.onKeydown, true);
        if (this.lastFocused) {
          this.lastFocused.focus();
          this.lastFocused = null;
        }
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

  onKeydown = (event: KeyboardEvent): void => {
    if (!this.open()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
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
    const panel = this.panel()?.nativeElement ?? null;

    // The PANEL itself is not one of the focusable controls: it only takes
    // the focus when there is nothing else to focus (or when the admin
    // clicks its padding). Tabbing from there must still stay inside the
    // dialog, in BOTH directions — otherwise Shift+Tab walks straight out
    // into the page behind.
    const inside = !!active && active !== panel && panel?.contains(active);

    if (event.shiftKey && (active === first || !inside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !inside)) {
      event.preventDefault();
      first.focus();
    }
  }

  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
