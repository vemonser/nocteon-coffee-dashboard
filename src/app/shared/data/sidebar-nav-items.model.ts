import { NavKey } from '../i18n/nav-i18n';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  permission?: string;
  children?: NavItem[];
}

export const icons: Record<NavKey, string> = {
  dashboard: 'lucideLayoutDashboard',
  orders: 'lucidePackage',
  users: 'lucideUsers',
  reviews: 'lucideStar',
  promoCodes: 'lucideTags',
  storeSettings:"lucideSettings2",
  journal: 'lucideBookOpen',
  products: 'lucideCoffee',
  categories: 'lucideTags',
  categoryDetail: 'lucideTags',
  origins: 'lucideGlobe',
  farms: 'lucideSprout',
  roastLevels: 'lucideFlame',
  roastLevelDetail: 'lucideFlame',
  shippingZones: 'lucideTruck',
  shippingZoneDetail: 'lucideTruck',
  processing: 'lucideSettings2',
  processingDetail: 'lucideSettings2',
  varieties: 'lucideGitBranch',
  varietyDetail: 'lucideGitBranch',
  tastingNotes: 'lucideDroplets',
  tastingNoteDetail: 'lucideDroplets',
  brewing: 'lucideFlaskConical',
  pairings: 'lucideUtensilsCrossed',
};
