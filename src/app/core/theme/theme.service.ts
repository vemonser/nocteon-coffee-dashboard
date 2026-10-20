import { computed, effect, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'nocteon-theme';

  /* -------------------------------------------------------------------------- */
  /*                                   State                                    */
  /* -------------------------------------------------------------------------- */

  private readonly _theme = signal<Theme>(this.loadTheme());
  readonly theme = this._theme.asReadonly();

  readonly isDark = computed(() => this._theme() === 'dark');

  readonly themeVersion = signal(0);

  constructor() {
    effect(() => {
      const theme = this._theme();

      document.documentElement.classList.toggle('dark', theme === 'dark');

      document.documentElement.style.colorScheme = theme;

      try {
        localStorage.setItem(this.THEME_KEY, theme);
      } catch {
        /* private-mode/quota — theme lasts for this session only */
      }
    });

    effect(() => {
      this._theme();

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
  /*                                  Storage                                   */
  /* -------------------------------------------------------------------------- */

  private loadTheme(): Theme {
    try {
      return localStorage.getItem(this.THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
}
