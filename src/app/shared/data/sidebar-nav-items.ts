import { NavItem } from './sidebar-nav-items.model';
import { Language } from '../../core/i18n/language';
import { navI18n, NavKey } from '../i18n/nav-i18n';

export type NavSectionKey = 'operations' | 'content' | 'catalog' | 'settings';

export interface NavSection {
  key: NavSectionKey;
  label: string;
  items: NavItem[];
}

// ← الأيقونات ثابتة — مش بتتغير باللغة
const icons: Record<NavKey, string> = {
  dashboard: 'lucideLayoutDashboard',
  orders: 'lucidePackage',
  users: 'lucideUsers',
  reviews: 'lucideStar',
  promoCodes: 'lucideTags',
  storeSettings: 'lucideSettings2',
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
  processing: 'lucideFactory',
  varieties: 'lucideGitBranch',
  varietyDetail: 'lucideGitBranch',
  processingDetail: 'lucideFactory',
  tastingNotes: 'lucideDroplets',
  tastingNoteDetail: 'lucideDroplets',
  brewing: 'lucideFlaskConical',
  pairings: 'lucideUtensilsCrossed',
  carts: 'lucideShoppingCart',
  productOptions: 'lucideSlidersHorizontal',
  broadcasts: 'lucideMegaphone',
  contactMessages: 'lucideMail',
};

const sectionLabels: Record<Language, Record<NavSectionKey, string>> = {
  en: {
    operations: 'Operations',
    content: 'Content',
    catalog: 'Catalog',
    settings: 'Settings',
  },
  ar: {
    operations: 'العمليات',
    content: 'المحتوى',
    catalog: 'الكتالوج',
    settings: 'الإعدادات',
  },
};

export function getNavItems(lang: Language) {
  const t = navI18n[lang];
  const s = sectionLabels[lang];

  const dashboard: NavItem = {
    label: t.dashboard,
    icon: icons.dashboard,
    route: '/dashboard',
  };

  const operations: NavItem[] = [
    { label: t.orders, icon: icons.orders, route: '/dashboard/orders', permission: 'order:read' },
    { label: t.carts, icon: icons.carts, route: '/dashboard/carts', permission: 'cart:manage' },
    { label: t.users, icon: icons.users, route: '/dashboard/users', permission: 'user:read' },
    {
      label: t.reviews,
      icon: icons.reviews,
      route: '/dashboard/reviews',
      permission: 'review:moderate',
    },
    {
      label: t.contactMessages,
      icon: icons.contactMessages,
      route: '/dashboard/contact-messages',
      permission: 'contact:read',
    },
  ];

  const content: NavItem[] = [
    { label: t.journal, icon: icons.journal, route: '/dashboard/journal', permission: 'journal:read' },
    {
      label: t.broadcasts,
      icon: icons.broadcasts,
      route: '/dashboard/broadcasts',
      permission: 'broadcast:read',
    },
    {
      label: t.notifications,
      icon: icons.notifications,
      route: '/dashboard/notifications',
      permission: 'notification:read',
    },
  ];

  const catalog: NavItem[] = [
    {
      label: t.products,
      icon: icons.products,
      route: '/dashboard/products',
      permission: 'product:read',
    },
    {
      label: t.productOptions,
      icon: icons.productOptions,
      route: '/dashboard/product-options',
      permission: 'product_option:read',
    },
    {
      label: t.categories,
      icon: icons.categories,
      route: '/dashboard/categories',
      permission: 'category:read',
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
      permission: 'roast_level:read',
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
  ];

  const settings: NavItem[] = [
    {
      label: t.storeSettings,
      icon: icons.storeSettings,
      route: '/dashboard/store-settings',
      permission: 'settings:update',
    },
  ];

  return {
    dashboard,
    sections: [
      { key: 'operations', label: s.operations, items: operations },
      { key: 'content', label: s.content, items: content },
      { key: 'catalog', label: s.catalog, items: catalog },
      { key: 'settings', label: s.settings, items: settings },
    ] satisfies NavSection[],
  };
}

/**
 * Which nav section a route belongs to. Lets the breadcrumb render "Catalog / Categories"
 * without every route having to declare a parent.
 */
export function sectionKeyForRoute(url: string): NavSectionKey | null {
  const path = url.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/dashboard';
  if (path === '/dashboard') return null;
  for (const section of getNavItems('en').sections) {
    if (section.items.some((item) => path === item.route || path.startsWith(`${item.route}/`))) {
      return section.key;
    }
  }
  return null;
}

export function sectionLabel(key: NavSectionKey, lang: Language): string {
  return sectionLabels[lang][key];
}