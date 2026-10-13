import { Component, input, output } from "@angular/core";
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector:
    'app-delete-dialog',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl:
    './delete-dialog.component.html',
})
export class DeleteDialogComponent {
  entity =
    input<any>();

  confirm =
    output<void>();

  cancel =
    output<void>();
}