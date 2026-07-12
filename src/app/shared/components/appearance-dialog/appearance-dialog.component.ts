import { Component, inject } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';


@Component({
  selector: 'app-appearance-dialog',
  standalone: true,
  templateUrl: './appearance-dialog.component.html',
  styleUrl: './appearance-dialog.component.css',
})
export class AppearanceDialogComponent {

  readonly theme = inject(ThemeService);

}