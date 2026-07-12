import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Directive({
  selector: '[hasPermission]'
})
export class HasPermissionDirective {
  private auth = inject(AuthService);

  private permission = signal('');

  constructor(
    private templateRef: TemplateRef<unknown>,
    private viewContainer: ViewContainerRef
  ) {
    effect(() => {
      const permission = this.permission();

      if (!permission) {
        this.viewContainer.clear();
        return;
      }

      if (this.auth.hasPermission(permission)) {
        this.viewContainer.clear();
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else {
        this.viewContainer.clear();
      }
    });
  }

  @Input()
  set hasPermission(permission: string) {
    this.permission.set(permission);
  }
}