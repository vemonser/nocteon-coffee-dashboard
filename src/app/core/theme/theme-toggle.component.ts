import { Component, inject } from '@angular/core';
import { ThemeService } from './theme.service';

import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.css',
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);

  toggle(event: MouseEvent): void {
    document.documentElement.style.setProperty('--x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--y', `${event.clientY}px`);

    this.theme.toggleTheme();
  }
}
