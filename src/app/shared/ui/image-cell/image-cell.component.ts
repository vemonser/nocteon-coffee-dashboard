import { Component, input } from '@angular/core';

@Component({
  selector: 'app-image-cell',
  standalone: true,
  templateUrl: `./image-cell.component.html`,
})
export class ImageCellComponent {
  src = input<string | null>(null);
  alt = input<string>('');
}
