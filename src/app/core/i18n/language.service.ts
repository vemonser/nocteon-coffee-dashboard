import { Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { FlipService } from '../animations/flip.service';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  Language,
} from './language';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  readonly language = signal<Language>(DEFAULT_LANGUAGE);

  constructor(
    private readonly transloco: TranslocoService,
    private readonly flip: FlipService,
  ) {}

  /**
   * Load the dictionary for the stored language BEFORE the app renders.
   *
   * `TranslocoService.setActiveLang()` is synchronous and does NOT load the
   * JSON — the dictionary is fetched separately. Between the two, the active
   * language points at a dictionary that is not there yet, and
   * `translate()` then returns THE KEY ITSELF (Transloco's missing-key
   * handler returns the key). That is where the raw
   * "orders.statuses.DELIVERED" strings on the dashboard came from.
   *
   * So the order is: load -> setActiveLang -> flip the signal. Nothing
   * observes the switch until the dictionary is present.
   */
  initialize(): Promise<void> {
    const lang = this.resolveInitialLanguage();
    return this.loadDictionary(lang).then(() => this.applyLanguage(lang));
  }

  current(): Language {
    return this.language();
  }

  toggle(): void {
    this.setLanguage(
      this.current() === 'ar'
        ? 'en'
        : 'ar'
    );
  }

  setLanguage(
    lang: Language,
    animate = true,
  ): void {
    if (
      lang === this.current() &&
      this.transloco.getActiveLang() === lang
    ) {
      return;
    }

    const action = () => {
      void this.loadDictionary(lang).then(() => this.applyLanguage(lang));
    };

    animate
      ? this.flip.animate(action)
      : action();
  }

  /** Load the dictionary for `lang`; resolves even if the fetch fails. */
  private loadDictionary(lang: Language): Promise<void> {
    try {
      return new Promise<void>((resolve) => {
        this.transloco.load(lang).subscribe({
          next: () => resolve(),
          error: () => resolve(),
        });
      });
    } catch {
      return Promise.resolve();
    }
  }

  private applyLanguage(
    lang: Language,
  ): void {
    this.transloco.setActiveLang(lang);

    this.language.set(lang);

    localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      lang,
    );

    this.updateDocument(lang);
  }

  private updateDocument(
    lang: Language,
  ): void {
    const html =
      document.documentElement;

    html.lang = lang;
    html.dir =
      lang === 'ar' ? 'rtl' : 'ltr';

    html.dataset['lang'] = lang;
  }

  private resolveInitialLanguage(): Language {
    const stored =
      localStorage.getItem(
        LANGUAGE_STORAGE_KEY,
      );

    if (
      stored === 'ar' ||
      stored === 'en'
    ) {
      return stored;
    }

    return navigator.language
      .toLowerCase()
      .startsWith('ar')
      ? 'ar'
      : 'en';
  }
}
