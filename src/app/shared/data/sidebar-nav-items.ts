import { NavItem } from './sidebar-nav-items.model';
import { Language } from '../../core/i18n/language';
import { navI18n, NavKey } from '../i18n/nav-i18n';

// ← الأيقونات ثابتة — مش بتتغير باللغة
const icons: Record<NavKey, string> = {
  dashboard: 'lucideLayoutDashboard',
  orders: 'lucidePackage',
  users: 'lucideUsers',
  promoCodes: 'lucideTags',
  reviews: 'lucideStar',
  storeSettings:"lucideSettings2",
  journal: 'lucideBookOpen',
  products: 'lucideCoffee',
  categories: 'lucideTags',
  notifications: 'lucideBellRing',
  categoryDetail: 'lucideTags',
  origins: 'lucideGlobe',
  farms: 'lucideSprout',
  roastLevels: 'lucideFlame',
  roastLevelDetail: 'lucideFlame',
  shippingZones: 'lucideShoppingBag',
  shippingZoneDetail: 'lucideShoppingBag',
  processing: 'lucideSettings2',
  varieties: 'lucideGitBranch',
  varietyDetail: 'lucideGitBranch',
  processingDetail: 'lucideGitBranch',
  tastingNotes: 'lucideDroplets',
  tastingNoteDetail: 'lucideDroplets',
  brewing: 'lucideFlaskConical',
  pairings: 'lucideUtensilsCrossed',
  carts: 'lucideShoppingCart',
};

export function getNavItems(lang: Language) {
  const t = navI18n[lang];

  return {
    main: [
      { label: t.dashboard, icon: icons.dashboard, route: '/dashboard' },
      { label: t.orders, icon: icons.orders, route: '/dashboard/orders', permission: 'order:read' },
      { label: t.carts, icon: icons.carts, route: '/dashboard/carts', permission: 'cart:manage' },
      { label: t.users, icon: icons.users, route: '/dashboard/users', permission: 'user:read' },
      {
        label: t.reviews,
        icon: icons.reviews,
        route: '/dashboard/reviews',
        permission: 'review:read',
      },
      {
        label: t.journal,
        icon: icons.journal,
        route: '/dashboard/journal',
        permission: 'journal:read',
      },
      {
        label: t.storeSettings,
        icon: icons.storeSettings,
        route: '/dashboard/store-settings',
        permission: 'settings:read',
      },
      {
        label: t.notifications,
        icon: icons.notifications,
        route: '/dashboard/notifications',
        permission: 'notification:read',
      },
    ] satisfies NavItem[],

    catalog: [
      {
        label: t.products,
        icon: icons.products,
        route: '/dashboard/products',
        permission: 'product:read',
      },
      {
        label: t.categories,
        icon: icons.categories,
        route: '/dashboard/categories',
        permission: 'category:read',
        // children:{
        //   label: t.categoryDetail,
        //   icon: icons.categories,
        //   route: '/dashboard/categories',
        //   permission: 'category:read',

        // }
      },
      {
        label: t.origins,
        icon: icons.origins,
        route: '/dashboard/origins',
        permission: 'origin:read',
      },
      { label: t.farms, icon: icons.farms, route: '/dashboard/farms', permission: 'farm:read' },
      {
        label: t.roastLevels,
        icon: icons.roastLevels,
        route: '/dashboard/roast-levels',
        permission: 'roast_levels:read',
      },
      {
        label: t.processing,
        icon: icons.processing,
        route: '/dashboard/processing-methods',
        permission: 'processing_method:read',
      },
      {
        label: t.varieties,
        icon: icons.varieties,
        route: '/dashboard/coffee-varieties',
        permission: 'coffee_variety:read',
      },
      {
        label: t.tastingNotes,
        icon: icons.tastingNotes,
        route: '/dashboard/tasting-notes',
        permission: 'tasting_note:read',
      },
      {
        label: t.shippingZones,
        icon: icons.shippingZones,
        route: '/dashboard/shipping-zones',
        permission: 'shipping:read',
      },
      {
        label: t.promoCodes,
        icon: icons.promoCodes,
        route: '/dashboard/promo-codes',
        permission: 'promo:read',
      },
      {
        label: t.brewing,
        icon: icons.brewing,
        route: '/dashboard/brewing-methods',
        permission: 'brewing_method:read',
      },
      {
        label: t.pairings,
        icon: icons.pairings,
        route: '/dashboard/pairings',
        permission: 'pairing:read',
      },
      {
        label: t.reviews,
        icon: icons.reviews,
        route: '/dashboard/reviews',
        permission: 'review:read',
      },
    ] satisfies NavItem[],
  };
}
