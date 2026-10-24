export interface ParsedPermission {
  resource: string;
  action: string;
}

export function parsePermission(slug: string): ParsedPermission {
  const [resource, action] = slug.split(':');
  return { resource: resource ?? '', action: action ?? '' };
}

export const PERMISSION_DOMAINS: Record<string, string[]> = {
  Sales: ['order', 'cart', 'shipping', 'promo'],
  Catalog: ['product', 'category', 'coffee_variety', 'roast_level', 'origin', 'farm', 'processing_method', 'brewing_method', 'pairing', 'tasting_note'],
  Content: ['journal', 'review', 'contact', 'broadcast', 'notification', 'wishlist'],
  'Users & access': ['user', 'address', 'role'],
  System: ['settings', 'dashboard', 'audit', 'ai'],
};

export const STANDARD_ACTIONS = ['read', 'create', 'update', 'delete'] as const;
export const STANDARD_ACTION_LABELS: Record<string, string> = {
  read: 'View',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
};

export const PERMISSION_LABELS: Record<string, string> = {
  'cart:read_all': 'View all carts',
  'cart:notify': 'Send reminders',
  'review:moderate': 'Moderate',
  'user:change_role': 'Change roles',
  'shipping:moderate': 'Moderate shipping',
};

export const SENSITIVE_PERMISSIONS = new Set<string>([
  'user:change_role',
  'user:delete',
  'settings:update',
  'audit:read',
  'ai:manage',
]);

export function domainOf(resource: string): string {
  for (const [domain, resources] of Object.entries(PERMISSION_DOMAINS)) {
    if (resources.includes(resource)) return domain;
  }
  return 'Other';
}

export function humanize(value: string): string {
  return value
    .split(/[_-]/)
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

export function resourceLabel(resource: string): string {
  // Fallback humanized; i18n keys can override in components.
  return humanize(resource);
}

export function actionLabel(slug: string): string {
  if (PERMISSION_LABELS[slug]) return PERMISSION_LABELS[slug];
  const { action } = parsePermission(slug);
  if (STANDARD_ACTION_LABELS[action]) return STANDARD_ACTION_LABELS[action];
  return humanize(action);
}

export function isSensitive(slug: string): boolean {
  return SENSITIVE_PERMISSIONS.has(slug);
}

export function isStandardAction(action: string): boolean {
  return (STANDARD_ACTIONS as readonly string[]).includes(action);
}

export interface GroupedPermission {
  domain: string;
  resource: string;
  slug: string;
  action: string;
}

export function groupPermissions(slugs: string[]): Record<string, Record<string, string[]>> {
  const result: Record<string, Record<string, string[]>> = {};
  for (const slug of slugs) {
    const { resource, action } = parsePermission(slug);
    const domain = domainOf(resource);
    result[domain] ??= {};
    result[domain][resource] ??= [];
    result[domain][resource].push(slug);
  }
  const domainOrder = Object.keys(PERMISSION_DOMAINS);
  const sorted: Record<string, Record<string, string[]>> = {};
  for (const domain of domainOrder) {
    if (!result[domain]) continue;
    const resources: Record<string, string[]> = {};
    for (const resource of Object.keys(result[domain]).sort()) {
      resources[resource] = result[domain][resource].sort();
    }
    sorted[domain] = resources;
  }
  // append unknown domains (Other) last
  for (const domain of Object.keys(result)) {
    if (sorted[domain]) continue;
    const resources: Record<string, string[]> = {};
    for (const resource of Object.keys(result[domain]).sort()) {
      resources[resource] = result[domain][resource].sort();
    }
    sorted[domain] = resources;
  }
  return sorted;
}

export const ALL_PERMISSIONS: string[] = ["category:create", "category:read", "category:update", "category:delete", "product:create", "product:read", "product:update", "product:delete", "origin:create", "origin:read", "origin:update", "origin:delete", "farm:create", "farm:read", "farm:update", "farm:delete", "roast_level:create", "roast_level:read", "roast_level:update", "roast_level:delete", "processing_method:create", "processing_method:read", "processing_method:update", "processing_method:delete", "coffee_variety:create", "coffee_variety:read", "coffee_variety:update", "coffee_variety:delete", "tasting_note:create", "tasting_note:read", "tasting_note:update", "tasting_note:delete", "brewing_method:create", "brewing_method:read", "brewing_method:update", "brewing_method:delete", "pairing:create", "pairing:read", "pairing:update", "pairing:delete", "journal:create", "journal:read", "journal:update", "journal:delete", "order:create", "order:read", "order:update", "order:delete", "review:create", "review:read", "review:moderate", "review:update", "review:delete", "shipping:create", "shipping:read", "shipping:moderate", "shipping:update", "shipping:delete", "user:read", "user:create", "user:update", "user:change_role", "user:delete", "address:read", "address:update", "settings:read", "settings:update", "promo:read", "promo:update", "promo:delete", "promo:create", "dashboard:read", "dashboard:update", "notification:read", "notification:update", "notification:delete", "broadcast:create", "broadcast:read", "broadcast:delete", "contact:read", "contact:update", "contact:delete", "cart:manage", "cart:read_all", "cart:notify", "wishlist:manage", "role:read", "role:manage", "audit:read", "ai:manage"];
