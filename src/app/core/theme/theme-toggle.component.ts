import { Component, computed, inject, signal } from '@angular/core';
import { ThemeService } from './theme.service';

import { TranslocoPipe } from '@jsverse/transloco';

/**
 * The light/dark switch.
 *
 * The button is an ICON, so the icon is never the only thing that says what
 * pressing it does:
 *
 *  - the accessible NAME states the action and its result — "Switch to dark
 *    theme" — not the current mode ("Dark"), which is what a bare label read
 *    as a mode switch with no direction;
 *  - a polite live region states which theme is now in effect. Without it a
 *    screen-reader user pressed a button, heard nothing change, and had to
 *    discover the new theme by reading the page again (FE-25a).
 *
 * The icon swap alone is a visual signal only — it is `aria-hidden`, so it
 * is not read as an image name either.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.css',
})
export class ThemeToggleComponent {
  readonly theme = inject(ThemeService);

  /**
   * The i18n key of the sentence announced after a switch.
   *
   * A KEY, not a translated string: the region must follow a runtime language
   * change, so the template resolves it through the pipe. It starts EMPTY, so
   * the region carries no text at mount — a live region only announces
   * changes, and pre-filling it would announce the theme on every page load.
   */
  readonly announcementKey = signal<string>('');

  /** The accessible name: the action, and the theme it leads to. */
  readonly nextThemeLabel = computed(() =>
    this.theme.isDark() ? 'appearance.switchToLight' : 'appearance.switchToDark',
  );

  toggle(event: MouseEvent): void {
    document.documentElement.style.setProperty('--x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--y', `${event.clientY}px`);

    this.theme.toggleTheme();

    // Read AFTER the switch: the sentence says what is in effect now.
    this.announcementKey.set(
      this.theme.isDark() ? 'appearance.darkEnabled' : 'appearance.lightEnabled',
    );
  }
}
