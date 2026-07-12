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

  initialize(): void {
    const lang = this.resolveInitialLanguage();
    this.applyLanguage(lang);
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
    if (lang === this.current()) {
      return;
    }

    const action = () => {
      this.applyLanguage(lang);
    };

    animate
      ? this.flip.animate(action)
      : action();
  }

  private applyLanguage(
    lang: Language,
  ): void {
    this.language.set(lang);

    this.transloco.setActiveLang(lang);

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