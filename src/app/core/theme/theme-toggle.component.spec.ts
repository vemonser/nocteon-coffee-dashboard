import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Injectable } from '@angular/core';
import { provideTransloco, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';

import { ThemeToggleComponent } from './theme-toggle.component';
import { ThemeService } from './theme.service';

/**
 * FE-25a — the theme toggle says what it does and what it did.
 *
 * The icon is `aria-hidden`, so the ONLY thing a screen reader can report is
 * the accessible name and the live region. Both are pinned here:
 *
 *  - the name is the ACTION plus the theme it leads to ("Switch to dark
 *    theme"), not the current mode;
 *  - after the switch, a polite live region says which theme is now in
 *    effect, and that region exists BEFORE the interaction — a region created
 *    together with its text is not announced.
 */

const DICT: Record<string, string> = {
  'appearance.switchToDark': 'Switch to dark theme',
  'appearance.switchToLight': 'Switch to light theme',
  'appearance.darkEnabled': 'Dark theme enabled',
  'appearance.lightEnabled': 'Light theme enabled',
};

/** An empty dictionary: the wording comes from `DICT`, not the network. */
@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

describe('ThemeToggleComponent', () => {
  let fixture: ComponentFixture<ThemeToggleComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.removeItem('nocteon-theme');
    document.documentElement.classList.remove('dark');

    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: EmptyLoader,
        }),
      ],
    }).compileComponents();

    TestBed.inject(TranslocoService).setTranslation(DICT, 'en');

    fixture = TestBed.createComponent(ThemeToggleComponent);
    TestBed.inject(ThemeService).setTheme('light');
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('nocteon-theme');
  });

  const button = (): HTMLButtonElement => element.querySelector('button')!;
  const status = (): HTMLElement => element.querySelector('[role="status"]')!;

  it('names the theme the press will switch TO, not the current mode', () => {
    expect(button().getAttribute('aria-label')).toBe('Switch to dark theme');
  });

  it('keeps a polite live region in the DOM before any interaction, empty', () => {
    expect(status()).not.toBeNull();
    expect(status().getAttribute('aria-live')).toBe('polite');
    expect(status().textContent?.trim()).toBe('');
  });

  it('announces the theme now in effect, and switches the document with it', () => {
    button().click();
    fixture.detectChanges();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(status().textContent?.trim()).toBe('Dark theme enabled');
    // The action name flips with the mode, so the next press is described too.
    expect(button().getAttribute('aria-label')).toBe('Switch to light theme');
  });

  it('switches back, and the announcement follows (a changed string is announced)', () => {
    button().click();
    fixture.detectChanges();
    button().click();
    fixture.detectChanges();

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(status().textContent?.trim()).toBe('Light theme enabled');
  });
});
