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
  lucideMoreVertical,
  lucideRefreshCw,
  lucidePrinter,
  lucideCircleSlash,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';

/**
 * One entry of a row's overflow menu.
 *
 * `label` is a transloco key (or a literal). `icon` is the NAME of an icon
 * the cell provides — the cell owns the icon registry, so the host does not
 * have to.
 */
export interface RowMenuAction {
  id: string;
  label: string;
  icon?: string;
  /** Rendered in the destructive colour (a cancel, a delete). */
  danger?: boolean;
}

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
    HlmDropdownMenuImports,
    RouterModule,
  ],
  providers: [
    provideIcons({
      lucideEye,
      lucidePencil,
      lucideRotateCcw,
      lucideTrash,
      lucideTrash2,
      lucideMoreVertical,
      lucideRefreshCw,
      lucidePrinter,
      lucideCircleSlash,
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
   * The row's overflow menu.
   *
   * design.md §10: "Row actions: one visible action, plus a kebab menu when
   * there are more than two." A row with four actions therefore shows one
   * and hides three in a menu, so the column stays narrow and the actions
   * stay scannable.
   */
  readonly menuActions = input<RowMenuAction[]>([]);

  /** The chosen menu entry, with the row it belongs to. */
  readonly menuAction = output<{ id: string; item: any }>();

  /**
   * The row's PRIMARY action — a LABELLED button, not an icon.
   *
   * <p>design.md §10: one visible action, plus a kebab menu when there are
   * more than two. An unlabelled icon makes the reader GUESS what the
   * yellow cross means, and a reviewer approved by mistake is a review
   * shown to a customer that should not have been.
   */
  readonly primaryAction = input<{ id: string; label: string } | null>(null);

  onMenuAction(action: RowMenuAction): void {
    this.menuAction.emit({ id: action.id, item: this.item() });
  }

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