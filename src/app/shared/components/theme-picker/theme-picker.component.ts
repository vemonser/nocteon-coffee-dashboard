import { Component, inject } from '@angular/core';
import { ThemeService, ColorTheme } from '../../../core/theme/theme.service';
import { RippleService } from '../../../core/service/ripple.service';
import { THEME_COLORS } from '../../../core/theme/theme.constants';

@Component({
  selector: 'app-theme-picker',
  standalone: true,
  imports: [],
  templateUrl: './theme-picker.component.html',
  styleUrl: './theme-picker.component.css',
})
export class ThemePickerComponent {
  protected readonly themeService = inject(ThemeService);
  private readonly rippleService = inject(RippleService);

  readonly colors = Object.entries(THEME_COLORS).map(([name, hex]) => ({
    name: name as ColorTheme,
    hex,
  }));

  onColorClick(event: MouseEvent, color: ColorTheme): void {

    if (color === this.themeService.color()) {
      return;
    }

    const container =
      (document.querySelector('.dashboard-layout') as HTMLElement) ?? document.body;

    this.rippleService.playColorRipple(
      container,
      event.clientX,
      event.clientY,
      THEME_COLORS[color],
      () => this.themeService.setColor(color),
    );
  }
}
