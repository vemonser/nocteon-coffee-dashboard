// Static route list for the QA harness. Param routes use a fixture resolver
// that opens the first row of the matching list page.
export type QaRoute = {
  id: string;
  path: string; // absolute path starting with /
  title: string; // expected nav label (sentence case)
  listPath?: string; // for param routes, list page to open first row
  paramSelector?: string; // selector for first row link
};

export const routes: QaRoute[] = [
  { id: 'dashboard', path: '/dashboard', title: 'Dashboard' },
  { id: 'users', path: '/dashboard/users', title: 'Users' },
  { id: 'users-roles', path: '/dashboard/users/roles', title: 'Roles' },
  { id: 'journal', path: '/dashboard/journal', title: 'Journal posts' },
  { id: 'journal-new', path: '/dashboard/journal/new', title: 'New post' },
  { id: 'store-settings', path: '/dashboard/store-settings', title: 'Store settings' },
  { id: 'categories', path: '/dashboard/categories', title: 'Categories' },
  { id: 'shipping-zones', path: '/dashboard/shipping-zones', title: 'Shipping zones' },
  { id: 'origins', path: '/dashboard/origins', title: 'Origins' },
  { id: 'farms', path: '/dashboard/farms', title: 'Farms' },
  { id: 'processing-methods', path: '/dashboard/processing-methods', title: 'Processing methods' },
  { id: 'roast-levels', path: '/dashboard/roast-levels', title: 'Roast levels' },
  { id: 'coffee-varieties', path: '/dashboard/coffee-varieties', title: 'Coffee varieties' },
  { id: 'tasting-notes', path: '/dashboard/tasting-notes', title: 'Tasting notes' },
  { id: 'reviews', path: '/dashboard/reviews', title: 'Reviews' },
  { id: 'product-options', path: '/dashboard/product-options', title: 'Product options' },
  { id: 'newsletter', path: '/dashboard/newsletter', title: 'Newsletter' },
  { id: 'broadcasts', path: '/dashboard/broadcasts', title: 'Broadcasts' },
  { id: 'contact-messages', path: '/dashboard/contact-messages', title: 'Contact messages' },
  { id: 'brewing-methods', path: '/dashboard/brewing-methods', title: 'Brewing methods' },
  { id: 'notifications', path: '/dashboard/notifications', title: 'Notifications' },
  { id: 'promo-codes', path: '/dashboard/promo-codes', title: 'Promo codes' },
  { id: 'pairings', path: '/dashboard/pairings', title: 'Pairings' },
  { id: 'products', path: '/dashboard/products', title: 'Products' },
  { id: 'products-new', path: '/dashboard/products/new', title: 'New product' },
  { id: 'orders', path: '/dashboard/orders', title: 'Orders' },
  { id: 'carts', path: '/dashboard/carts', title: 'Carts' },
  { id: 'profile', path: '/dashboard/profile', title: 'Profile' },
  { id: 'unauthorized', path: '/unauthorized', title: 'Access denied' },
];

// Param routes resolved at runtime by opening first row of list page.
export const paramRoutes: QaRoute[] = [
  { id: 'user-view', path: '/dashboard/users/:id', title: 'User', listPath: '/dashboard/users' },
  { id: 'journal-edit', path: '/dashboard/journal/:slug/edit', title: 'Edit post', listPath: '/dashboard/journal' },
  { id: 'category-edit', path: '/dashboard/categories/:slug', title: 'Category', listPath: '/dashboard/categories' },
  { id: 'origin-edit', path: '/dashboard/origins/:slug', title: 'Origin', listPath: '/dashboard/origins' },
  { id: 'farm-edit', path: '/dashboard/farms/:slug', title: 'Farm', listPath: '/dashboard/farms' },
  { id: 'processing-edit', path: '/dashboard/processing-methods/:slug', title: 'Processing method', listPath: '/dashboard/processing-methods' },
  { id: 'roast-edit', path: '/dashboard/roast-levels/:slug', title: 'Roast level', listPath: '/dashboard/roast-levels' },
  { id: 'coffee-variety-edit', path: '/dashboard/coffee-varieties/:slug', title: 'Coffee variety', listPath: '/dashboard/coffee-varieties' },
  { id: 'tasting-note-edit', path: '/dashboard/tasting-notes/:slug', title: 'Tasting note', listPath: '/dashboard/tasting-notes' },
  { id: 'review-detail', path: '/dashboard/reviews/:id', title: 'Review', listPath: '/dashboard/reviews' },
  { id: 'product-option-edit', path: '/dashboard/product-options', title: 'Product option', listPath: '/dashboard/product-options' },
  { id: 'broadcast-edit', path: '/dashboard/broadcasts', title: 'Broadcast', listPath: '/dashboard/broadcasts' },
  { id: 'contact-message', path: '/dashboard/contact-messages', title: 'Contact message', listPath: '/dashboard/contact-messages' },
  { id: 'brewing-edit', path: '/dashboard/brewing-methods/:slug', title: 'Brewing method', listPath: '/dashboard/brewing-methods' },
  { id: 'notification-detail', path: '/dashboard/notifications/:id', title: 'Notification', listPath: '/dashboard/notifications' },
  { id: 'promo-edit', path: '/dashboard/promo-codes/:slug', title: 'Promo code', listPath: '/dashboard/promo-codes' },
  { id: 'pairing-edit', path: '/dashboard/pairings/:slug', title: 'Pairing', listPath: '/dashboard/pairings' },
  { id: 'product-edit', path: '/dashboard/products/:slug/edit', title: 'Product', listPath: '/dashboard/products' },
  { id: 'order-detail', path: '/dashboard/orders/:id', title: 'Order', listPath: '/dashboard/orders' },
  { id: 'cart-detail', path: '/dashboard/carts', title: 'Cart', listPath: '/dashboard/carts' },
];
