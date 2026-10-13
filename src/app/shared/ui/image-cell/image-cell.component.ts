import { Component, input } from '@angular/core';

import { TranslocoPipe } from '@jsverse/transloco';
@Component({
  selector: 'app-image-cell',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: `./image-cell.component.html`,
})
export class ImageCellComponent {
  src = input<string | null>(null);
  alt = input<string>('');
}
