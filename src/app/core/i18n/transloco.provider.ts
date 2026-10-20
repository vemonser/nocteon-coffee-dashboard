import {
  isDevMode,
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';

import { provideTransloco } from '@jsverse/transloco';

import { AvailableLangs } from './language';
import { TranslocoHttpLoader } from './transloco-loader';

export function provideAppTransloco(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: AvailableLangs,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        // §11/§12: a missing key must fail loudly in development — raw keys
        // must never reach the screen silently.
        missingHandler: { logMissingKey: true, useFallbackTranslation: false },
      },
      loader: TranslocoHttpLoader,
    }),
  ]);
}