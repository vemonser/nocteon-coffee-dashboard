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
  journal: 'lucideBookOpen',
  products: 'lucideCoffee',
  categories: 'lucideTags',
  categoryDetail: 'lucideTags',
  origins: 'lucideGlobe',
  farms: 'lucideSprout',
  roastLevels: 'lucideFlame',
  processing: 'lucideSettings2',
  varieties: 'lucideGitBranch',
  tastingNotes: 'lucideDroplets',
  brewing: 'lucideFlaskConical',
  pairings: 'lucideUtensilsCrossed',
};
