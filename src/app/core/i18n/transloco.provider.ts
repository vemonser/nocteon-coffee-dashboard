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
      },
      loader: TranslocoHttpLoader,
    }),
  ]);
}