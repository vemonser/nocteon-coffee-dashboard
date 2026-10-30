import { Component, ElementRef, HostListener, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2, lucideX } from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

/**
 * The one create/edit dialog for the catalog lists.
 *
 * <p>Every catalog page (pairings and the coffee-data pages) writes the same
 * chrome: a title, the bilingual fields, the image picker, an inline error and
 * the Cancel / primary pair. Keeping it in one component is what makes the
 * wording, the footer order and the dirty-close question identical everywhere.
 *
 * <p>The page projects only the fields it owns; this component owns the shell,
 * the focus trap, Escape, the focus return to the trigger and the
 * "Discard changes?" question when the form is dirty.
 */
@Component({
  selector: 'app-crud-dialog',
  standalone: true,
  imports: [A11yModule, HlmButtonImports, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideLoader2, lucideX })],
  templateUrl: './crud-dialog.component.html',
})
export class CrudDialogComponent {
  readonly open = input<boolean>(false);
  /** Dialog heading, e.g. "Add pairing" / "Edit pairing". */
  readonly title = input.required<string>();
  /**
   * The primary action's label. Creating names the action ("Add pairing");
   * editing says "Save changes".
   */
  readonly primaryLabel = input.required<string>();
  readonly submitting = input<boolean>(false);
  /** Any other reason the primary action cannot run (invalid form, …). */
  readonly submitDisabled = input<boolean>(false);
  /** The form has unsaved edits — closing asks first. */
  readonly dirty = input<boolean>(false);
  /** Inline backend/validation error, shown above the actions. */
  readonly error = input<string | null>(null);
  readonly testId = input<string>('crud-dialog');

  readonly submitted = output<void>();
  readonly closed = output<void>();

  private readonly confirm = inject(ConfirmDialogService);
  private readonly transloco = inject(TranslocoService);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  /** Focus returns to whatever opened the dialog. */
  private readonly lastFocused = signal<HTMLElement | null>(null);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.lastFocused.set(document.activeElement as HTMLElement | null);
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        const trigger = this.lastFocused();
        if (trigger?.isConnected) trigger.focus();
        this.lastFocused.set(null);
      }
    });
  }

  /** Escape closes — through the same dirty guard as the close button. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.open()) return;
    void this.requestClose();
  }

  /** Backdrop click closes; a click inside the panel does not. */
  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) void this.requestClose();
  }

  /**
   * Close, asking first when there are unsaved edits. The question is the
   * app's shared confirm dialog — never `window.confirm`.
   */
  async requestClose(): Promise<void> {
    if (this.submitting()) return;
    if (this.dirty()) {
      const discard = await this.confirm.confirm({
        title: this.t('unsavedChanges.confirmTitle', 'Discard changes?'),
        message: this.t('unsavedChanges.confirmBody', 'Your changes to this item will be lost.'),
        confirmLabel: this.t('unsavedChanges.discard', 'Discard changes'),
        cancelLabel: this.t('unsavedChanges.keepEditing', 'Keep editing'),
        tone: 'destructive',
      });
      if (!discard) return;
    }
    this.closed.emit();
  }

  /** Keep the panel focusable as the trap's last resort. */
  focusPanel(): void {
    this.panel()?.nativeElement.focus();
  }

  private t(key: string, fallback: string): string {
    const translated = this.transloco.translate(key);
    return typeof translated === 'string' && translated.length > 0 && translated !== key
      ? translated
      : fallback;
  }
}
