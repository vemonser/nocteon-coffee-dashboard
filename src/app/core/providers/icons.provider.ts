import {
  makeEnvironmentProviders,
} from '@angular/core';

import { provideIcons } from '@ng-icons/core';

import {
  lucideDollarSign,
  lucideShoppingBag,
  lucideUsers,
  lucideChartColumn,
  lucideSettings,
  lucideHouse,
  lucideInbox,
} from '@ng-icons/lucide';

export function provideAppIcons() {
  return makeEnvironmentProviders([
    provideIcons({
      lucideDollarSign,
      lucideShoppingBag,
      lucideUsers,
      lucideChartColumn,
      lucideSettings,
      lucideHouse,
      lucideInbox,
    }),
  ]);
}