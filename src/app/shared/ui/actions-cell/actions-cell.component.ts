import { Component, input, output } from '@angular/core';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideEye,
  lucidePencil,
  lucideRotateCcw,
  lucideTrash,
  lucideTrash2,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';

@Component({
  selector: 'app-actions-cell',
  imports: [
    CommonModule,
    HasPermissionDirective,
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    BrnTooltip,
    HlmTooltipImports,
    RouterModule,
  ],
  providers: [
    provideIcons({
      lucideEye,
      lucidePencil,
      lucideRotateCcw,
      lucideTrash,
      lucideTrash2,
    }),
  ],
  templateUrl: './actions-cell.component.html',
  styleUrl: './actions-cell.component.css',
})
export class ActionsCellComponent {
  item = input.required<any>();
  editPermission = input<string>('');
  deletePermission = input<string>('');
  editLabel = input<string>('Edit');
  /** Key (or literal) for the destructive/soft-delete action. */
  deleteLabel = input<string>('common.delete');
  /**
   * False for a SOFT delete, which is reversible and stays neutral; true renders it in
   * the destructive colour. Red is reserved for permanent delete.
   */
  destructiveDelete = input<boolean>(true);
  viewLabel = input<string>('View');
  restoreLabel = input<string>('common.restore');
  restorePermission = input<string>('');
  permanentDeleteLabel = input<string>('common.deletePermanently');
  permanentDeletePermission = input<string>('');

  // Per-page visibility toggles (combined with the permission check).
  showView = input<boolean>(true);
  showEdit = input<boolean>(true);
  showDelete = input<boolean>(true);
  showRestore = input<boolean>(false);
  showPermanentDelete = input<boolean>(false);
  hasView = input<boolean>(true);

  /**
   * RouterLink command for the row's detail page. When set, the edit action
   * renders as a real anchor (middle-click / open-in-new-tab work) instead of a
   * button — used by lists whose detail page is the single edit surface.
   */
  editHref = input<any[] | null>(null);

  view = output<any>();
  edit = output<any>();
  delete = output<any>();
  restore = output<any>();
  permanentDelete = output<any>();

  /**
   * Exactly one text-colour class per action. Binding two competing `text-*`
   * utilities leaves the winner up to stylesheet order, so the destructive colour
   * silently lost to the muted one.
   */
  deleteColorClass(): string {
    return this.destructiveDelete()
      ? 'text-destructive hover:bg-destructive/10'
      : 'text-muted-foreground hover:text-foreground';
  }

  onEdit() {
    this.edit.emit(this.item());
  }
  onDelete() {
    this.delete.emit(this.item());
  }
  onRestore() {
    this.restore.emit(this.item());
  }
}