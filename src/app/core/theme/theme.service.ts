import { computed, effect, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
export type ColorTheme = 'emerald' | 'burgundy';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'nocteon-theme';
  private readonly COLOR_KEY = 'nocteon-accent';

  /* -------------------------------------------------------------------------- */
  /*                                   State                                    */
  /* -------------------------------------------------------------------------- */

  private readonly _theme = signal<Theme>(this.loadTheme());
  readonly theme = this._theme.asReadonly();

  private readonly _color = signal<ColorTheme>(this.loadColor());
  readonly color = this._color.asReadonly();

  readonly isDark = computed(() => this._theme() === 'dark');

 
  readonly themeVersion = signal(0);

  constructor() {
    effect(() => {
      const theme = this._theme();

      document.documentElement.classList.toggle('dark', theme === 'dark');

      document.documentElement.style.colorScheme = theme;

      localStorage.setItem(this.THEME_KEY, theme);
    });

    effect(() => {
      const color = this._color();

      if (color === 'burgundy') {
        document.documentElement.setAttribute('data-theme', 'burgundy');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }

      localStorage.setItem(this.COLOR_KEY, color);
    });

    effect(() => {
      this._theme();
      this._color();

      this.themeVersion.update((v) => v + 1);
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                                  Theme                                     */
  /* -------------------------------------------------------------------------- */

  toggleTheme(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    if (theme === this._theme()) {
      return;
    }

    this._theme.set(theme);
  }

  /* -------------------------------------------------------------------------- */
  /*                                  Accent                                    */
  /* -------------------------------------------------------------------------- */

  toggleAccent(): void {
    this.setColor(this._color() === 'emerald' ? 'burgundy' : 'emerald');
  }

  setColor(color: ColorTheme): void {
    if (color === this._color()) {
      return;
    }

    this._color.set(color);
  }

  /* -------------------------------------------------------------------------- */
  /*                                  Storage                                   */
  /* -------------------------------------------------------------------------- */

  private loadTheme(): Theme {
    const saved = localStorage.getItem(this.THEME_KEY);

    return saved === 'dark' ? 'dark' : 'light';
  }

  private loadColor(): ColorTheme {
    const saved = localStorage.getItem(this.COLOR_KEY);

    return saved === 'burgundy' ? 'burgundy' : 'emerald';
  }
}
