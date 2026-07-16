// shared/i18n/nav-i18n.ts
import { Language } from '../../core/i18n/language';

export type NavKey =
  | 'dashboard'
  | 'orders'
  | 'users'
  | 'reviews'
  | 'storeSettings'
  | 'journal'
  | 'products'
  | 'categories'
  | 'categoryDetail'
  | 'origins'
  | 'farms'
  | 'roastLevels'
  | 'promoCodes'
  | 'roastLevelDetail'
  | 'shippingZones'
  | 'shippingZoneDetail'
  | 'processing'
  | 'processingDetail'
  | 'varieties'
  | 'varietyDetail'
  | 'tastingNotes'
  | 'tastingNoteDetail'
  | 'brewing'
  | 'pairings';

export const navI18n: Record<Language, Record<NavKey, string>> = {
  en: {
    dashboard: 'Dashboard',
    orders: 'Orders',
    users: 'Users',
    reviews: 'Reviews',
    storeSettings: 'Store Settings',
    promoCodes: 'Promo Codes',
    journal: 'Journal',
    products: 'Products',
    categories: 'Categories',
    categoryDetail: 'Category',
    origins: 'Origins',
    farms: 'Farms',
    roastLevels: 'Roast Levels',
    roastLevelDetail: 'Roast Level',
    shippingZones: 'Shipping Zones',
    shippingZoneDetail: 'Shipping Zone',
    processing: 'Processing Methods',
    processingDetail: 'Processing Method',
    varieties: 'Coffee Varieties',
    varietyDetail: 'Coffee Variety',
    tastingNotes: 'Tasting Notes',
    tastingNoteDetail: 'Tasting Note',
    brewing: 'Brewing',
    pairings: 'Pairings',
  },
  ar: {
    dashboard: 'لوحة التحكم',
    orders: 'الطلبات',
    users: 'المستخدمين',
    reviews: 'التقييمات',
    storeSettings: 'إعدادات الموقع',
    promoCodes: 'رموز ترويجية',
    journal: 'المجلة',
    products: 'المنتجات',
    categories: 'الفئات',
    categoryDetail: 'الفئة',
    origins: 'الأصول',
    farms: 'المزارع',
    roastLevels: 'مستويات التحميص',
    roastLevelDetail: 'مستوى التحميص',
    shippingZones: 'مناطق الشحن',
    shippingZoneDetail: 'منطقة شحن',
    processing: 'المعالجة',
    processingDetail: 'طريقة المعالجة',
    varieties: 'الأصناف',
    varietyDetail: 'الصنف',
    tastingNotes: 'ملاحظات التذوق',
    tastingNoteDetail: 'ملاحظة التذوق',
    brewing: 'التحضير',
    pairings: 'التوافقات',
  },
};
