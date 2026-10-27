/**
 * Route -> permission map used by the permission-aware UI.
 *
 * The KEYS are ROUTES (not permissions): every dashboard route resolves to the
 * permission that must hold for it to be openable. The map is what the sidebar,
 * the 403 page and the sidebar all ask "may this person open this?".
 *
 * Single source for the permission→page mapping. The RBAC pass (A-tasks) put the
 * permission slugs here; the permission-awareness pass (C) consumes them for UX
 * only — the server stays the source of truth for actual authorization.
 */

/** The permission that opens the dashboard shell itself. Role-agnostic on
 *  purpose: ADMIN holds every permission, MODERATOR holds this one, and any
 *  future staff role can be granted it without a code change. */
export const DASHBOARD_ENTRY_PERMISSION = 'dashboard:read';

export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard': ['dashboard:read'],
  '/dashboard/orders': ['order:read'],
  '/dashboard/orders/new': ['order:create'],
  '/dashboard/orders/:id': ['order:read'],
  '/dashboard/carts': ['cart:read_all'],
  '/dashboard/reviews': ['review:moderate'],
  '/dashboard/reviews/:id': ['review:moderate'],
  '/dashboard/journal': ['journal:read'],
  '/dashboard/products': ['product:read'],
  '/dashboard/products/new': ['product:create'],
  '/dashboard/products/:slug/edit': ['product:update'],
  '/dashboard/newsletter': ['user:read'],
  '/dashboard/product-options': ['product_option:read'],
  '/dashboard/users': ['user:read'],
  '/dashboard/roles': ['user:read'],
  '/dashboard/roles/:roleName': ['user:read'],
  '/dashboard/users/roles': ['user:read'],
  '/dashboard/users/roles/:roleName': ['user:read'],
  '/dashboard/users/:id': ['user:read'],
  '/dashboard/store-settings': ['settings:update'],
  '/dashboard/categories': ['category:read'],
  '/dashboard/categories/:slug': ['category:read'],
  '/dashboard/shipping-zones': ['shipping:read'],
  '/dashboard/shipping-zones/:id': ['shipping:read'],
  '/dashboard/origins': ['origin:read'],
  '/dashboard/origins/:slug': ['origin:read'],
  '/dashboard/farms': ['farm:read'],
  '/dashboard/farms/:slug': ['farm:read'],
  '/dashboard/processing-methods': ['processing_method:read'],
  '/dashboard/processing-methods/:slug': ['processing_method:read'],
  '/dashboard/roast-levels': ['roast_level:read'],
  '/dashboard/roast-levels/:slug': ['roast_level:read'],
  '/dashboard/coffee-varieties': ['coffee_variety:read'],
  '/dashboard/coffee-varieties/:slug': ['coffee_variety:read'],
  '/dashboard/tasting-notes': ['tasting_note:read'],
  '/dashboard/tasting-notes/:slug': ['tasting_note:read'],
  '/dashboard/brewing-methods': ['brewing_method:read'],
  '/dashboard/brewing-methods/:slug': ['brewing_method:read'],
  '/dashboard/pairings': ['pairing:read'],
  '/dashboard/pairings/:slug': ['pairing:read'],
  '/dashboard/broadcasts': ['broadcast:read'],
  '/dashboard/broadcasts/:id': ['broadcast:read'],
  '/dashboard/contact-messages': ['contact:read'],
  '/dashboard/contact-messages/:id': ['contact:read'],
  '/dashboard/notifications': ['notification:read'],
  '/dashboard/notifications/:id': ['notification:read'],
  '/dashboard/promo-codes': ['promo:read'],
  '/dashboard/promo-codes/:slug': ['promo:read'],
};

/** Route -> permission, for path templates that carry path params. */
export function permissionForRoute(template: string): string | null {
  const clean = (template === '/dashboard' ? '/dashboard' : template).replace(/:[A-Za-z_]+/g, 'X');
  const exact = Object.keys(ROUTE_PERMISSIONS).find((k) => k === template);
  if (exact) return ROUTE_PERMISSIONS[exact][0];
  const match = Object.keys(ROUTE_PERMISSIONS).find(
    (k) => clean === k.replace(/:[A-Za-z_]+/g, 'X') && template.includes(':'),
  );
  if (match) return ROUTE_PERMISSIONS[match][0];
  // Longest-prefix match with param support.
  let best: string | null = null;
  for (const key of Object.keys(ROUTE_PERMISSIONS)) {
    const regex = new RegExp(
      '^' + key.replace(/:[A-Za-z_]+/g, '[^/]+') + '/?$',
    );
    if (regex.test(template)) {
      if (best === null || key.length > best.length) best = key;
    }
  }
  if (best) return ROUTE_PERMISSIONS[best][0];
  return null;
}
