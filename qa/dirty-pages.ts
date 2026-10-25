// Pages where an unsaved-changes modal is expected when navigating away dirty.
export const dirtyPages: { path: string; fieldSelector: string; value: string }[] = [
  { path: '/dashboard/products/new', fieldSelector: 'input[formControlName="name"]', value: 'QA dirty test' },
  { path: '/dashboard/journal/new', fieldSelector: 'input[formControlName="title"]', value: 'QA dirty test' },
  { path: '/dashboard/profile', fieldSelector: 'input[formControlName="firstName"]', value: 'QA dirty test' },
  { path: '/dashboard/store-settings', fieldSelector: 'input', value: 'QA dirty test' },
];

// Pages that edit data but cannot be exercised by the top-level dirty check yet.
export const skippedDirtyPages: { path: string; reason: string }[] = [
  { path: '/dashboard/products/:slug/edit', reason: 'param route; requires resolving an existing product slug first' },
  { path: '/dashboard/journal/:slug/edit', reason: 'param route; requires resolving an existing post slug first' },
  { path: '/dashboard/broadcasts (composer)', reason: 'dialog-based composer; not reachable by route alone' },
  { path: '/dashboard/categories (new/edit)', reason: 'dialog-based; requires opening the add/edit dialog' },
  { path: '/dashboard/categories/:slug', reason: 'param route; edit form lives in the detail view' },
  { path: '/dashboard/origins/:slug', reason: 'param route' },
  { path: '/dashboard/farms/:slug', reason: 'param route' },
  { path: '/dashboard/processing-methods/:slug', reason: 'param route' },
  { path: '/dashboard/roast-levels/:slug', reason: 'param route' },
  { path: '/dashboard/coffee-varieties/:slug', reason: 'param route' },
  { path: '/dashboard/tasting-notes/:slug', reason: 'param route' },
  { path: '/dashboard/brewing-methods/:slug', reason: 'param route' },
  { path: '/dashboard/pairings/:slug', reason: 'param route' },
  { path: '/dashboard/shipping-zones/:slug', reason: 'param route' },
  { path: '/dashboard/promo-codes/:slug', reason: 'param route' },
  { path: '/dashboard/users/roles (editor)', reason: 'editor is dialog-based' },
  { path: 'Add/Edit user dialog', reason: 'dialog-based form; needs dialog harness' },
  { path: 'Add/Edit option dialog', reason: 'dialog-based form; needs dialog harness' },
  { path: 'Contact reply dialog', reason: 'dialog-based form; needs dialog harness' },
];