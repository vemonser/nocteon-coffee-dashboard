import {
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';

import { firstValueFrom } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { LanguageService } from './language.service';
import { ThemeService } from '../theme/theme.service';
 
export function provideAppInitializers() {
  return makeEnvironmentProviders([
    // Await the dictionary load: the app must not render before the
    // active language's JSON exists, or transloco returns raw keys.
    provideAppInitializer(() => inject(LanguageService).initialize()),

    // Instantiate so the stored light/dark theme applies on every route,
    // even pages with no theme-consuming component.
    provideAppInitializer(() => {
      inject(ThemeService);
    }),

    provideAppInitializer(() => {
      return firstValueFrom(
        inject(AuthService)
          .initializeSession(),
      );
    }),
  ]);
}