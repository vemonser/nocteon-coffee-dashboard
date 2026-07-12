import { Component, input } from '@angular/core';

@Component({
  selector: 'app-status-cell',
  standalone: true,
  templateUrl: `./status-cell.component.html`,
})
export class StatusCellComponent {
  value = input<boolean>(false);
}
