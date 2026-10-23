import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { PermissionService } from '../../core/auth/permission.service';

@Directive({ selector: '[appCan]' })
export class CanDirective {
  private templateRef = inject(TemplateRef<any>);
  private vcr = inject(ViewContainerRef);
  private perm = inject(PermissionService);
  private slug = '';
  constructor() {
    effect(() => {
      const allowed = this.perm.has(this.slug);
      this.vcr.clear();
      if (allowed) this.vcr.createEmbeddedView(this.templateRef);
    });
  }
  @Input() set appCan(value: string) { this.slug = value; }
}
