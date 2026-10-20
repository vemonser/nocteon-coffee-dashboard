import { describe, expect, it } from 'vitest';

import { DataTableComponent } from './data-table.component';

/**
 * The shared table's cell switch is CLOSED — a page cannot add a column type
 * on its own. These ids are the ones the reviews page needs, and this
 * test fails the moment one of them is renamed or dropped, instead of the
 * page silently rendering a plain text cell.
 */
describe('DataTableComponent headers', () => {
  it('translates the review column headers', () => {
    expect(DataTableComponent.HEADER_KEYS['Product']).toBe('reviews.columns.product');
    expect(DataTableComponent.HEADER_KEYS['Reviewer']).toBe('reviews.columns.reviewer');
    expect(DataTableComponent.HEADER_KEYS['Rating']).toBe('reviews.columns.rating');
    expect(DataTableComponent.HEADER_KEYS['Comment']).toBe('reviews.columns.comment');
  });

  it('budgets the review columns', () => {
    expect(DataTableComponent.COLUMN_WIDTHS['reviewer']).toBe('180px');
    expect(DataTableComponent.COLUMN_WIDTHS['rating']).toBe('120px');
    expect(DataTableComponent.COLUMN_WIDTHS['comment']).toBe('320px');
  });
});
