import {
  lucideDollarSign,
  lucideShoppingBag,
  lucideUsers,
  lucideChartColumn,
  lucideSettings,
  lucideHouse,
  lucideInbox,
} from '@ng-icons/lucide';

/**
 * The icon names every authenticated page may use by string
 * (`<ng-icon name="lucideInbox">`, the empty-state default, the status badge).
 *
 * Registered by the shell (`LayoutComponent`), NOT by `bootstrapApplication`.
 *
 * Why: bundlers split at *module* granularity. One eager import of
 * `@ng-icons/lucide` from the bootstrap graph hoists the whole set that any
 * lazy chunk references — measured at 131 icons / 46.6 kB — into the initial
 * chunk. The public pages (login, password reset, unauthorized) register the
 * handful they use through their own `provideIcons`, so nothing outside the
 * shell needs this registry.
 */
export const APP_ICONS = {
  lucideDollarSign,
  lucideShoppingBag,
  lucideUsers,
  lucideChartColumn,
  lucideSettings,
  lucideHouse,
  lucideInbox,
} as const;
