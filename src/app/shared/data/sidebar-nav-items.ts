import { NavItem } from './sidebar-nav-items.model';
import { Language } from '../../core/i18n/language';
import { navI18n, NavKey } from '../i18n/nav-i18n';

export type NavSectionKey = 'operations' | 'access' | 'content' | 'catalog' | 'coffeeData' | 'settings';

/**
 * A labelled group of links.
 *
 * `items` are the section's IMPLICIT parents: each one carries the permission and
 * the children of the whole section, and its label is a copy of `label`. The sidebar
 * renders the section heading once (from `label`) and drops the parent row
 * (FE-25 D4+A), so a section never shows its own name twice. The parent route is
 * still what `sectionKeyForRoute()` matches on, which is how the breadcrumb and the
 * auto-open logic find the section for a page.
 */
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
  roles: 'lucideShield',
  reviews: 'lucideStar',
  promoCodes: 'lucideTags',
  storeSettings: 'lucideSettings2',
  journal: 'lucideBookOpen',
  journalCategories: 'lucideTags',
  products: 'lucideCoffee',
  categories: 'lucideTags',
  notifications: 'lucideBellRing',
  categoryDetail: 'lucideTags',
  orderDetail: 'lucidePackage',
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
  productTags: 'lucideTag',
  broadcasts: 'lucideMegaphone',
  newsletter: 'lucideMailPlus',
  contactMessages: 'lucideMail',
  coffeeData: 'lucideDatabase',
  auditLog: 'lucideScrollText',
};

const sectionLabels: Record<Language, Record<NavSectionKey, string>> = {
  en: {
    operations: 'Operations',
    access: 'Access',
    content: 'Content',
    catalog: 'Catalog',
    coffeeData: 'Coffee data',
    settings: 'Settings',
  },
  ar: {
    operations: 'العمليات',
    access: 'الوصول',
    content: 'المحتوى',
    catalog: 'الكتالوج',
    coffeeData: 'بيانات القهوة',
    settings: 'الإعدادات',
  },
};

function makeParent(labelKey: string, icon: string, route: string, permission: string | undefined, children: NavItem[], t: Record<string, string>, s: Record<string, string>): NavItem {
  return {
    label: s[labelKey],
    icon,
    route,
    permission,
    children,
  };
}

export function getNavItems(lang: Language) {
  const t = navI18n[lang];
  const s = sectionLabels[lang];

  const dashboard: NavItem = {
    label: t.dashboard,
    icon: icons.dashboard,
    route: '/dashboard',
  };

  // Operations parent with children
  const operationsParent = makeParent(
    'operations',  // Use section label key
    icons.orders,
    '/dashboard/orders',
    'order:read',
    [
      { label: t.orders, icon: icons.orders, route: '/dashboard/orders', permission: 'order:read' },
      { label: t.carts, icon: icons.carts, route: '/dashboard/carts', permission: 'cart:read_all' },
      { label: t.reviews, icon: icons.reviews, route: '/dashboard/reviews', permission: 'review:moderate' },
      { label: t.contactMessages, icon: icons.contactMessages, route: '/dashboard/contact-messages', permission: 'contact:read' },
    ],
    t,
    s
  );

  // Access parent with children (Users + Roles & permissions)
  const accessParent = makeParent(
    'access',
    icons.users,
    '/dashboard/users',
    undefined,
    [
      { label: t.users, icon: icons.users, route: '/dashboard/users', permission: 'user:read' },
      { label: t.roles, icon: icons.roles ?? icons.users, route: '/dashboard/users/roles', permission: 'user:read' },
    ],
    t,
    s
  );

  // Content parent with children
  const contentParent = makeParent(
    'content',  // Use section label key
    icons.journal,
    '/dashboard/journal',
    'journal:read',
    [
      { label: t.journal, icon: icons.journal, route: '/dashboard/journal', permission: 'journal:read' },
      { label: t.journalCategories, icon: icons.journalCategories, route: '/dashboard/journal/categories', permission: 'journal:read' },
      { label: t.broadcasts, icon: icons.broadcasts, route: '/dashboard/broadcasts', permission: 'broadcast:read' },
      { label: t.newsletter, icon: icons.newsletter, route: '/dashboard/newsletter', permission: 'user:read' },
      { label: t.notifications, icon: icons.notifications, route: '/dashboard/notifications', permission: 'notification:read' },
    ],
    t,
    s
  );

  // Catalog parent with children
  const catalogParent = makeParent(
    'catalog',  // Use section label key
    icons.products,
    '/dashboard/products',
    'product:read',
    [
      { label: t.products, icon: icons.products, route: '/dashboard/products', permission: 'product:read' },
      { label: t.productTags, icon: icons.productTags, route: '/dashboard/product-tags', permission: 'product:read' },
      { label: t.productOptions, icon: icons.productOptions, route: '/dashboard/product-options', permission: 'product_option:read' },
      { label: t.categories, icon: icons.categories, route: '/dashboard/categories', permission: 'category:read' },
    ],
    t,
    s
  );

  // Coffee Data parent with children (unchanged)
  const coffeeDataParent: NavItem = {
    label: t.coffeeData || 'Coffee data',
    icon: icons.products,
    route: '/dashboard/origins',
    permission: 'origin:read',
    children: [
      { label: t.origins, icon: icons.origins, route: '/dashboard/origins', permission: 'origin:read' },
      { label: t.farms, icon: icons.farms, route: '/dashboard/farms', permission: 'farm:read' },
      { label: t.roastLevels, icon: icons.roastLevels, route: '/dashboard/roast-levels', permission: 'roast_level:read' },
      { label: t.processing, icon: icons.processing, route: '/dashboard/processing-methods', permission: 'processing_method:read' },
      { label: t.varieties, icon: icons.varieties, route: '/dashboard/coffee-varieties', permission: 'coffee_variety:read' },
      { label: t.tastingNotes, icon: icons.tastingNotes, route: '/dashboard/tasting-notes', permission: 'tasting_note:read' },
      { label: t.shippingZones, icon: icons.shippingZones, route: '/dashboard/shipping-zones', permission: 'shipping:read' },
      { label: t.promoCodes, icon: icons.promoCodes, route: '/dashboard/promo-codes', permission: 'promo:read' },
      { label: t.brewing, icon: icons.brewing, route: '/dashboard/brewing-methods', permission: 'brewing_method:read' },
      { label: t.pairings, icon: icons.pairings, route: '/dashboard/pairings', permission: 'pairing:read' },
    ],
  };

  // Settings parent with child
  const settingsParent = makeParent(
    'settings',
    icons.storeSettings,
    '/dashboard/store-settings',
    'settings:update',
    [
      { label: t.storeSettings, icon: icons.storeSettings, route: '/dashboard/store-settings', permission: 'settings:update' },
      // The audit trail: its own permission, so a role can read the log
      // without being able to change the store's settings (see V13).
      { label: t.auditLog, icon: icons.auditLog, route: '/dashboard/settings/audit', permission: 'audit:read' },
    ],
    t,
    s
  );

  const operations: NavItem[] = [operationsParent];
  const access: NavItem[] = [accessParent];
  const content: NavItem[] = [contentParent];
  const catalog: NavItem[] = [catalogParent];
  const coffeeData: NavItem[] = [coffeeDataParent];
  const settings: NavItem[] = [settingsParent];

  return {
    dashboard,
    sections: [
      { key: 'operations', label: s.operations, items: operations },
      { key: 'access', label: s.access, items: access },
      { key: 'content', label: s.content, items: content },
      { key: 'catalog', label: s.catalog, items: catalog },
      { key: 'coffeeData', label: s.coffeeData, items: coffeeData },
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
    // Also check children
    for (const item of section.items) {
      if (item.children?.some((child) => path === child.route || path.startsWith(`${child.route}/`))) {
        return section.key;
      }
    }
  }
  return null;
}

export function sectionLabel(key: NavSectionKey, lang: Language): string {
  return sectionLabels[lang][key];
}