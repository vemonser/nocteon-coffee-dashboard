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
  | 'auditLog'
  | 'coffeeData';

/**
 * Labels for routes that are NOT sidebar destinations: create pages, detail
 * pages and the profile. They belong to the breadcrumb only.
 *
 * <p>They are a separate union on purpose. `NavKey` is also the key type of the
 * sidebar icon map, which holds one icon per navigation item; putting these in
 * it would demand icons for pages that never appear in the nav. The breadcrumb
 * key type is the union of both.
 *
 * <p>These labels used to be missing entirely while the routes cast their data
 * to `NavKey`, so the trail printed the RAW route key ("newProduct").
 */
export type BreadcrumbKey =
  | 'newProduct'
  | 'editProduct'
  | 'newJournalPost'
  | 'editJournalPost'
  | 'newOrigin'
  | 'originDetail'
  | 'newFarm'
  | 'farmDetail'
  | 'userDetails'
  | 'brewingMethodDetail'
  | 'pairingDetail'
  | 'notification'
  | 'notificationDetails'
  | 'promoDetails'
  | 'profile';

export type BreadcrumbNavKey = NavKey | BreadcrumbKey;

export const navI18n: Record<Language, Record<BreadcrumbNavKey, string>> = {
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
    brewing: 'Brewing methods',
    pairings: 'Pairings',
    carts: 'Carts',
    productOptions: 'Product options',
    productTags: 'Tags',
    broadcasts: 'Broadcasts',
    newsletter: 'Newsletter',
    contactMessages: 'Contact messages',
    auditLog: 'Audit log',
    coffeeData: 'Coffee data',
    newProduct: 'Add product',
    editProduct: 'Edit product',
    newJournalPost: 'New post',
    editJournalPost: 'Edit post',
    newOrigin: 'Add origin',
    originDetail: 'Origin',
    newFarm: 'Add farm',
    farmDetail: 'Farm',
    userDetails: 'User',
    brewingMethodDetail: 'Brewing method',
    pairingDetail: 'Pairing',
    notification: 'Notifications',
    notificationDetails: 'Notification',
    promoDetails: 'Promo code',
    profile: 'Profile',
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
    brewing: 'طرق التحضير',
    pairings: 'التوافقات',
    carts: 'السلة',
    productOptions: 'خيارات المنتجات',
    productTags: 'الوسوم',
    broadcasts: 'الرسائل الجماعية',
    newsletter: 'النشرة البريدية',
    contactMessages: 'رسائل التواصل',
    auditLog: 'سجل التدقيق',
    coffeeData: 'بيانات القهوة',
    newProduct: 'إضافة منتج',
    editProduct: 'تعديل المنتج',
    newJournalPost: 'مقال جديد',
    editJournalPost: 'تعديل المقال',
    newOrigin: 'إضافة منشأ',
    originDetail: 'المنشأ',
    newFarm: 'إضافة مزرعة',
    farmDetail: 'المزرعة',
    userDetails: 'المستخدم',
    brewingMethodDetail: 'طريقة التحضير',
    pairingDetail: 'التوافق',
    notification: 'الإشعارات',
    notificationDetails: 'الإشعار',
    promoDetails: 'رمز ترويجي',
    profile: 'الملف الشخصي',
  },
};
