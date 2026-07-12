import { Component, inject } from '@angular/core';
import { ThemeService } from './theme.service';


@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  templateUrl: './theme-toggle.component.html',
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);

  toggle(event: MouseEvent): void {
    document.documentElement.style.setProperty('--x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--y', `${event.clientY}px`);

    // const apply = () => this.theme.toggleTheme();
    this.theme.toggleTheme();
    
    // if ('startViewTransition' in document) {
    //   (document as any).startViewTransition(apply);
    // } else {
    //   apply();
    // }
  }
}
