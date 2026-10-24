import { Directive, HostBinding, HostListener, Input, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { PermissionService } from '../../core/auth/permission.service';

/**
 * Disables the host control (button / input / select / …) when the current user
 * lacks the given permission.
 *
 * This is the single "action-level" companion of `appCan` (which is
 * structural: render-or-not). `appCanDisable` answers the other half of the
 * UX layer: the page is open (the reader HAS the view permission), the action
 * is not (the reader LACKS the action permission) — so the control stays visible
 * and readable, but cannot fire, with a tooltip naming the missing slug.
 */
@Directive({
  selector: '[appCanDisable]',
})
export class CanDisableDirective {
  private perm = inject(PermissionService);
  private transloco = inject(TranslocoService);

  permission = '';

  @Input('appCanDisable')
  set appCanDisable(slug: string) {
    this.permission = slug;
  }

  @HostBinding('disabled')
  get disabled(): boolean {
    const allowed = this.perm.has(this.permission);
    if (allowed) {
      this.removeTitle();
      return false;
    }
    return true;
  }

  @HostBinding('attr.aria-disabled')
  get ariaDisabled(): boolean {
    return this.disabled;
  }

  @HostBinding('attr.title')
  get tooltip(): string | null {
    if (this.perm.has(this.permission)) {
      this.removeTitle();
      return null;
    }
    const key = 'permissions.actionDenied';
    const value = this.transloco.translate(key, { slug: this.permission });
    return typeof value === 'string' && value !== key ? value : `You don't have permission (${this.permission})`;
  }

  private removeTitle(): void {
    // Setting the getter above is enough; this keeps intent explicit.
  }
}