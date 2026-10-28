// shared/i18n/nav-i18n.ts
import { Language } from '../../core/i18n/language';

export type NavKey =
  | 'dashboard'
  | 'orders'
  | 'users'
  | 'roles'
  | 'reviews'
  | 'storeSettings'
  | 'journal'
  | 'journalCategories'
  | 'products'
  | 'categories'
  | 'notifications'
  | 'categoryDetail'
  | 'orderDetail'
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
  | 'pairings'
  | 'carts'
  | 'productOptions'
  | 'productTags'
  | 'broadcasts'
  | 'newsletter'
  | 'contactMessages'
  | 'coffeeData';

export const navI18n: Record<Language, Record<NavKey, string>> = {
  en: {
    dashboard: 'Dashboard',
    orders: 'Orders',
    users: 'Users',
    roles: 'Roles & permissions',
    reviews: 'Reviews',
    storeSettings: 'Store settings',
    promoCodes: 'Promo codes',
    journal: 'Journal',
    journalCategories: 'Journal categories',
    products: 'Products',
    notifications: 'Notifications',
    categories: 'Categories',
    categoryDetail: 'Category',
    orderDetail: 'Order',
    origins: 'Origins',
    farms: 'Farms',
    roastLevels: 'Roast levels',
    roastLevelDetail: 'Roast level',
    shippingZones: 'Shipping zones',
    shippingZoneDetail: 'Shipping zone',
    processing: 'Processing methods',
    processingDetail: 'Processing method',
    varieties: 'Coffee varieties',
    varietyDetail: 'Coffee variety',
    tastingNotes: 'Tasting notes',
    tastingNoteDetail: 'Tasting note',
    brewing: 'Brewing',
    pairings: 'Pairings',
    carts: 'Carts',
    productOptions: 'Product options',
    productTags: 'Tags',
    broadcasts: 'Broadcasts',
    newsletter: 'Newsletter',
    contactMessages: 'Contact messages',
    coffeeData: 'Coffee data',
  },
  ar: {
    dashboard: 'لوحة التحكم',
    orders: 'الطلبات',
    users: 'المستخدمين',
    roles: 'الأدوار والصلاحيات',
    reviews: 'التقييمات',
    notifications: 'الإشعارات',
    storeSettings: 'إعدادات الموقع',
    promoCodes: 'رموز ترويجية',
    journal: 'المجلة',
    journalCategories: 'فئات الجورنال',
    products: 'المنتجات',
    categories: 'الفئات',
    categoryDetail: 'الفئة',
    orderDetail: 'الطلب',
    origins: 'المناشئ',
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
    carts: 'السلة',
    productOptions: 'خيارات المنتجات',
    productTags: 'الوسوم',
    broadcasts: 'الرسائل الجماعية',
    newsletter: 'النشرة البريدية',
    contactMessages: 'رسائل التواصل',
    coffeeData: 'بيانات القهوة',
  },
};
