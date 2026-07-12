import {
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';

import { firstValueFrom } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { LanguageService } from './language.service';
 
export function provideAppInitializers() {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      inject(LanguageService).initialize();
    }),

    provideAppInitializer(() => {
      return firstValueFrom(
        inject(AuthService)
          .initializeSession(),
      );
    }),
  ]);
}