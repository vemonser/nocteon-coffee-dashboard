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
        class="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
        (click)="onBackdrop($event)"
        (keydown)="onKeydown($event)"
      >
        <div
          #panel
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          [attr.data-testid]="testId()"
          [attr.aria-labelledby]="testId() + '-title'"
          class="flex w-full max-w-lg max-h-[90vh] flex-col rounded-[var(--radius-card)] border bg-card shadow-2xl outline-none"
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
