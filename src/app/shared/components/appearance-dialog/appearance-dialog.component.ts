import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../../core/theme/theme.service';


@Component({
  selector: 'app-appearance-dialog',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './appearance-dialog.component.html',
  styleUrl: './appearance-dialog.component.css',
})
export class AppearanceDialogComponent {

  readonly theme = inject(ThemeService);

}