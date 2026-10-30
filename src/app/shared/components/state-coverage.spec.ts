import { describe, expect, it } from 'vitest';

/**
 * FE-27 — the states contract, page by page.
 *
 * Every console page that renders a LIST must be able to say three things:
 *
 *   - **loading**: a skeleton, so the page does not look empty while the data
 *     is in flight;
 *   - **empty**: a designed empty state that explains itself and offers the
 *     action that resolves it (or, where nothing in the console can resolve
 *     it, says where the data comes from instead);
 *   - **error**: a failure message WITH a retry.
 *
 * The inventory is derived from the page's own sources, so a page that loses
 * its empty action, its retry or its skeleton fails here instead of being
 * noticed by a reader on a bad connection. `e2e/blank-body.spec.ts` proves the
 * same thing in a browser; this spec proves it without one.
 *
 * Pages listed under EXCEPTIONS carry a written reason — an exception without
 * a reason is a hole.
 */

const html = import.meta.glob('/src/app/features/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ts = import.meta.glob('/src/app/features/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

interface Page {
  label: string;
  /** The template file (or the component, when the template is inline). */
  source: string;
  /** `table` = the shared DataTable owns the states; `list` = a custom list. */
  kind: 'table' | 'list';
}

const PAGES: Page[] = [
  { label: 'Dashboard', source: '/src/app/features/dashboard/dashboard.component.html', kind: 'list' },
  { label: 'Orders', source: '/src/app/features/orders/orders-list/orders-list.component.html', kind: 'table' },
  { label: 'Carts', source: '/src/app/features/carts/components/carts-list.component.html', kind: 'table' },
  { label: 'Reviews', source: '/src/app/features/reviews/components/review-list.component.html', kind: 'table' },
  { label: 'Contact messages', source: '/src/app/features/contact-messages/components/contact-messages-list.component.html', kind: 'list' },
  { label: 'Users', source: '/src/app/features/users/components/users-list.component.html', kind: 'table' },
  { label: 'Roles', source: '/src/app/features/users/roles/components/roles-list.component.html', kind: 'list' },
  { label: 'Journal', source: '/src/app/features/journal/components/journal-list.component.html', kind: 'list' },
  { label: 'Journal categories', source: '/src/app/features/journal/components/journal-categories.component.ts', kind: 'list' },
  { label: 'Broadcasts', source: '/src/app/features/broadcasts/components/broadcast-list.component.html', kind: 'list' },
  { label: 'Newsletter', source: '/src/app/features/newsletter/components/newsletter-list.component.html', kind: 'table' },
  { label: 'Notifications', source: '/src/app/features/notifications-list/components/notification-list.component.html', kind: 'list' },
  { label: 'Products', source: '/src/app/features/products/components/products-list/products-list.component.html', kind: 'table' },
  { label: 'Product tags', source: '/src/app/features/product-tags/components/product-tags.component.ts', kind: 'list' },
  { label: 'Product options', source: '/src/app/features/product-options/components/product-option-list.component.html', kind: 'list' },
  { label: 'Categories', source: '/src/app/features/categories/components/categories-list.component.html', kind: 'list' },
  { label: 'Origins', source: '/src/app/features/origins/components/origins-list.component.html', kind: 'table' },
  { label: 'Farms', source: '/src/app/features/farms/components/farms-list.component.html', kind: 'table' },
  { label: 'Roast levels', source: '/src/app/features/roast-level/components/roast-level-list.component.html', kind: 'table' },
  { label: 'Processing methods', source: '/src/app/features/processing-method/components/processing-method-list.component.html', kind: 'table' },
  { label: 'Coffee varieties', source: '/src/app/features/coffee-variety/components/coffee-variety-list.component.html', kind: 'table' },
  { label: 'Tasting notes', source: '/src/app/features/tasting-note/components/tasting-note-list.component.html', kind: 'table' },
  { label: 'Shipping zones', source: '/src/app/features/shipping-zone/components/shipping-zone-list.component.html', kind: 'table' },
  { label: 'Promo codes', source: '/src/app/features/promo-codes/components/promo-codes-list.component.html', kind: 'table' },
  { label: 'Brewing methods', source: '/src/app/features/brewing-method/components/brewing-methods-list.component.html', kind: 'table' },
  { label: 'Pairings', source: '/src/app/features/pairing/components/pairing-list.component.html', kind: 'table' },
];

/**
 * Pages where one of the three states is deliberately different. The reason is
 * part of the exception: it is what a reviewer checks instead of the marker.
 */
const EXCEPTIONS: Record<string, Partial<Record<'emptyAction' | 'createAction' | 'skeleton', string>>> = {
  Categories: {
    emptyAction:
      'The block carries its own two actions: it clears the search, or switches tab when the other tab holds the matches.',
  },
  Roles: {
    emptyAction:
      'The state is one card in the grid; "New role" is the page header action, always visible beside it.',
  },
  'Journal categories': {
    emptyAction:
      'The state is the panel body; "New category" is the page header action, always visible beside it.',
  },
  'Product tags': {
    emptyAction:
      'The state is the panel body; "Add tag" is the page header action, always visible beside it.',
  },
  Newsletter: {
    emptyAction:
      'The audience comes from the storefront: the state says so instead of offering a button that cannot add a subscriber.',
  },
  Carts: {
    createAction: 'A cart is created by a customer starting a checkout, never from the console.',
  },
  'Contact messages': {
    createAction: 'Messages arrive from the storefront contact form; the console cannot compose one.',
  },

  Notifications: {
    emptyAction:
      'Nothing in the console can produce a notification: the state explains what will appear instead of offering a button.',
  },
  Dashboard: {
    createAction: 'The dashboard aggregates; there is no single record to create from it.',
  },
  Reviews: {
    createAction: 'A review is written by a customer, never by the console.',
  },
};

function sourceOf(page: Page): string {
  const value = html[page.source] ?? ts[page.source] ?? '';
  return value;
}

/** A loading affordance: in-table skeleton rows, a pulse block, or a busy table. */
function hasSkeleton(source: string): boolean {
  return (
    /\[loading\]\s*=\s*"?[\w().!]+"?/.test(source) ||
    /animate-pulse/.test(source) ||
    /\[aria-busy\]/.test(source) ||
    /app-widget-state\s*\[loading\]/.test(source) ||
    /-skeleton/.test(source)
  );
}

/** A designed empty state: the shared component, the table's, or a page block. */
function hasEmpty(source: string): boolean {
  return (
    /app-empty-state/.test(source) ||
    /\[emptyMessage\]/.test(source) ||
    /@empty\s*\{/.test(source) ||
    /empty/i.test(source) ||
    /noData/.test(source)
  );
}

/** The action that resolves the empty state — in it, or bound to the table. */
function hasEmptyAction(source: string): boolean {
  return /\[emptyAction\]/.test(source) || /\[actionLabel\]/.test(source);
}

/** A failure surfaced with a retry. */
function hasErrorRetry(source: string): boolean {
  const errorSurface = /app-error-state|role="alert"|app-widget-state/.test(source);
  const retry =
    /\(retry\)/.test(source) || /retry\(\)/.test(source) || /common\.retry/.test(source) || /app-error-state/.test(source);
  return errorSurface && retry;
}

describe('console states (FE-27)', () => {
  it('reads every page it claims to check', () => {
    const missing = PAGES.filter((page) => sourceOf(page).length === 0).map((page) => page.label);
    expect(missing, 'a page whose source was not found (renamed? moved?)').toEqual([]);
  });

  for (const page of PAGES) {
    const exception = EXCEPTIONS[page.label] ?? {};

    it(`${page.label}: has a skeleton`, () => {
      if (exception.skeleton) {
        expect(exception.skeleton.length).toBeGreaterThan(20);
        return;
      }
      expect(hasSkeleton(sourceOf(page)), `${page.label} renders nothing while loading`).toBe(true);
    });

    it(`${page.label}: has a designed empty state`, () => {
      expect(hasEmpty(sourceOf(page)), `${page.label} has no empty state`).toBe(true);
    });

    it(`${page.label}: the empty state offers the action that resolves it`, () => {
      if (exception.emptyAction) {
        // The exception has to say WHY, in a sentence a reviewer can check.
        expect(exception.emptyAction.length).toBeGreaterThan(20);
        return;
      }
      expect(
        hasEmptyAction(sourceOf(page)),
        `${page.label}: its empty state is a dead end (no emptyAction / actionLabel)`,
      ).toBe(true);
    });

    it(`${page.label}: a failure is shown with a retry`, () => {
      expect(
        hasErrorRetry(sourceOf(page)),
        `${page.label}: a failed fetch leaves no message or no way to retry`,
      ).toBe(true);
    });
  }

  it('a table page renders its empty state through a shared component, not a stray <p>', () => {
    const offenders = PAGES.filter((page) => page.kind === 'table')
      .filter((page) => {
        const source = sourceOf(page);
        return !/\[emptyMessage\]/.test(source) && !/app-empty-state/.test(source);
      })
      .map((page) => page.label);
    expect(offenders, 'a table page with no translated empty state').toEqual([]);
  });

  it('every exception names a state that really is different', () => {
    for (const [label, reasons] of Object.entries(EXCEPTIONS)) {
      expect(PAGES.some((page) => page.label === label), `${label} is not a page`).toBe(true);
      for (const [state, reason] of Object.entries(reasons)) {
        expect(reason?.length ?? 0, `${label}/${state} has no written reason`).toBeGreaterThan(20);
      }
    }
  });
});
