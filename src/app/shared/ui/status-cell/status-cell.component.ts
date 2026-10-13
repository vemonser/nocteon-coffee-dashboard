import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-status-cell',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: `./status-cell.component.html`,
})
export class StatusCellComponent {
  value = input<boolean>(false);
}
