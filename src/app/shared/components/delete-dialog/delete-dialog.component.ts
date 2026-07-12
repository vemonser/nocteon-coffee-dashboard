import { Component, input, output } from "@angular/core";

@Component({
  selector:
    'app-delete-dialog',
  standalone: true,
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