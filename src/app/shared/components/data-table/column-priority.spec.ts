import { describe, expect, it } from 'vitest';

import { COLUMN_TIERS, DataTableComponent } from './data-table.component';

/**
 * FE-26 — the column priority of the orders and products lists.
 *
 * A 375px screen cannot show eight columns, so the lists decide which ones
 * leave and which ones stay. This spec pins the DECISION, because the
 * alternative — trusting a screenshot nobody re-takes — is how a "temporary"
 * column quietly disappears:
 *
 *  - the identity, the state, the money and the actions never leave;
 *  - the detail columns that do leave are complete on the row's own page;
 *  - the columns FE-14 (product rating), FE-15 (CSV export) and FE-18/19
 *    (bulk bar and its export) added are NOT part of the priority at all.
 *
 * `DataTableComponent.hidesOnPhone` is the rule the template applies; the page
 * constants below are what each list hands it.
 */

const tableTemplates = import.meta.glob(
  '/src/app/shared/components/data-table/*.html',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const pages = import.meta.glob('/src/app/features/{orders,products}/**/*.{ts,html}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;


const ordersTs = pages['/src/app/features/orders/orders-list/orders-list.component.ts'] ?? '';
const ordersHtml =
  pages['/src/app/features/orders/orders-list/orders-list.component.html'] ?? '';
const productsTs =
  pages['/src/app/features/products/components/products-list/products-list.component.ts'] ?? '';
const productsHtml =
  pages['/src/app/features/products/components/products-list/products-list.component.html'] ?? '';

/** The ids a page passes to the table, read from its `phoneHiddenColumns`. */
function phoneHidden(source: string): string[] {
  const match = /phoneHiddenColumns\s*=\s*\[([^\]]*)\]/.exec(source);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('column priority (FE-26)', () => {
  it('loads the sources it claims to check', () => {
    expect(ordersTs).toBeTruthy();
    expect(productsTs).toBeTruthy();
    expect(ordersHtml).toBeTruthy();
    expect(productsHtml).toBeTruthy();
  });

  it('the rule is a pure function, and an empty list hides nothing', () => {
    expect(DataTableComponent.hidesOnPhone('itemCount', [])).toBe(false);
    expect(DataTableComponent.hidesOnPhone('itemCount', ['itemCount'])).toBe(true);
    expect(DataTableComponent.hidesOnPhone('itemCount', ['paymentMethod'])).toBe(false);
  });

  it('orders: a phone keeps the identity, the states, the money and the actions', () => {
    const hidden = phoneHidden(ordersTs);
    // The two that leave are the DETAIL columns, both complete on the order page.
    expect(hidden.sort()).toEqual(['itemCount', 'paymentMethod']);
    for (const kept of ['orderNumber', 'customer', 'orderStatus', 'paymentStatus', 'totalAmount', 'actions']) {
      expect(DataTableComponent.hidesOnPhone(kept, hidden), `${kept} must stay on a phone`).toBe(
        false,
      );
    }
  });

  it('products: a phone keeps the catalogue facts, and drops only the two filters', () => {
    const hidden = phoneHidden(productsTs);
    expect(hidden.sort()).toEqual(['category', 'productType']);
    for (const kept of [
      'main_en',
      'productPrice',
      'productStock',
      'productRating',
      'isActive',
      'featured',
      'actions',
    ]) {
      expect(DataTableComponent.hidesOnPhone(kept, hidden), `${kept} must stay on a phone`).toBe(
        false,
      );
    }
  });

  it('the columns FE-14/FE-15/FE-18/FE-19 added are untouched', () => {
    // Rating is a kept column, not a hidden one.
    expect(phoneHidden(productsTs)).not.toContain('productRating');
    // The CSV exports are still there, on both pages.
    expect(productsHtml).toContain('data-testid="products-export"');
    expect(ordersHtml).toContain('data-testid="orders-export"');
    // And the bulk bar with its own export (FE-18/FE-19).
    expect(ordersHtml).toContain('data-testid="orders-bulk-bar"');
    expect(ordersHtml).toContain('data-testid="orders-bulk-export"');
    expect(ordersHtml).toContain('data-testid="orders-bulk-change-status"');
  });

  it('the two tiers are two breakpoints, and the phone floor follows the hidden columns', () => {
    // Dates/ids leave at 1024; the detail columns leave at 640. The stylesheet
    // carries the same two numbers — a media query cannot read a constant.
    expect(COLUMN_TIERS).toEqual({ narrow: 1023.5, phone: 639.5 });

    // The table applies both tiers to the header, the cells AND the skeleton
    // rows, so the shape does not jump when the data lands.
    const table =
      Object.entries(tableTemplates).find(([path]) =>
        path.endsWith('data-table.component.html'),
      )?.[1] ?? '';
    expect(table).toContain('[class.col-phone-hide]');
    expect(table).toContain('[class.col-narrow-hide]');
    expect(table).toContain('data-phone-hidden');

    // A wide floor on a phone would scroll through empty space.
    expect(ordersHtml).toContain('[minWidthPhone]');
    expect(productsHtml).toContain('[minWidthPhone]');
  });

  it('both lists put the same states on screen: skeleton, designed empty, error with retry', () => {
    // The in-table skeleton rows (the table stays mounted while loading).
    expect(ordersHtml).toContain('[loading]="loading()"');
    expect(productsHtml).toContain('[loading]="loading()"');
    // The designed empty state with its resolving action.
    expect(ordersHtml).toContain('[emptyHint]="emptyHint()"');
    expect(ordersHtml).toContain('[emptyAction]="emptyAction()"');
    expect(productsHtml).toContain('[emptyHint]="emptyHint()"');
    expect(productsHtml).toContain('[emptyAction]="emptyAction()"');
    // The page-level error is the shared panel, with a retry.
    expect(ordersHtml).toContain('<app-error-state');
    expect(productsHtml).toContain('<app-error-state');
  });
});

