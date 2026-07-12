import { Component, input, output } from '@angular/core';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-actions-cell',
  imports: [CommonModule,HasPermissionDirective],
  templateUrl: './actions-cell.component.html',
  styleUrl: './actions-cell.component.css',
})
export class ActionsCellComponent {
  item = input.required<any>();
  editPermission = input<string>('');
  deletePermission = input<string>('');
  editLabel = input<string>('Edit');
  deleteLabel = input<string>('Delete');
  viewLabel = input<string>('View');

  view = output<any>();
  edit = output<any>();
  delete = output<any>();

  onEdit() {
    this.edit.emit(this.item());
  }
  onDelete() {
    this.delete.emit(this.item());
  }
  
}
