import { Component, effect, ElementRef, HostListener, inject, viewChild } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [HlmButtonImports, HlmInputImports, FormsModule, A11yModule],
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  readonly svc = inject(ConfirmDialogService);
  typed = '';

  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');

  constructor() {
    // Move focus INTO the dialog when it opens: Esc (a document-level
    // listener below) and the tab trap both need the focus to be inside,
    // and the reader must not be left on the trigger behind the overlay.
    effect(() => {
      if (this.svc.state()) {
        setTimeout(() => this.surface()?.nativeElement?.focus(), 0);
      }
    });
  }

  /**
   * Esc closes the dialog from anywhere. The handler used to sit on the
   * overlay, but keydown only bubbles from the focused element — with the
   * focus left on the trigger (outside the overlay) it never fired
   * (UX_AUDIT_products.md #2a measured this).
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.svc.state()) this.svc.resolve(false);
  }
}
