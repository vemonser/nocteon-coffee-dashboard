import { Component, input } from '@angular/core';

import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideImage } from '@ng-icons/lucide';

@Component({
  selector: 'app-image-cell',
  standalone: true,
  imports: [TranslocoPipe, NgIcon],
  providers: [provideIcons({ lucideImage })],
  templateUrl: `./image-cell.component.html`,
})
export class ImageCellComponent {
  src = input<string | null>(null);
  alt = input<string>('');
}