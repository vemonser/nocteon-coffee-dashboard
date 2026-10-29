import { Injectable } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideTransloco, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createColumnHelper } from '@tanstack/angular-table';

import { DataTableComponent } from './data-table.component';

/**
 * PRODUCTS-06 — the Stock column renders the API aggregate, and an empty
 * value stays empty.
 *
 * The column used to be gated on `hasStockData()` because the list endpoint
 * had no stock fields. The API sends `totalStock` / `variantsCount` /
 * `lowStockVariantCount` now, so the column is unconditional; a row whose
 * values are genuinely null must render blank, not "0" or "undefined".
 */

interface StockRow {
  id: number;
  stock: number | null;
  variants: number | null;
  low: number | null;
}

const DICT: Record<string, string> = {
  'common.stock': 'Stock',
  'products.table.lowStockBadge': 'Low stock',
  'products.table.variantCount_one': '{{count}} variant',
  'products.table.variantCount_other': '{{count}} variants',
};

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

const columnHelper = createColumnHelper<StockRow>();
const COLUMNS = [
  columnHelper.accessor((row) => ({ stock: row.stock, variants: row.variants, low: row.low }), {
    id: 'productStock',
    header: 'Stock',
  }),
];

describe('DataTableComponent stock column (PRODUCTS-06)', () => {
  let fixture: ComponentFixture<DataTableComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: EmptyLoader,
        }),
      ],
    }).compileComponents();

    TestBed.inject(TranslocoService).setTranslation(DICT, 'en');

    fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentRef.setInput('columns', COLUMNS);
    fixture.componentRef.setInput('data', [
      { id: 1, stock: 12, variants: 3, low: 0 },
      { id: 2, stock: null, variants: null, low: null },
    ]);
    fixture.detectChanges();

    // The money pipe's settings service loads once at construction; the stock
    // cell does not need it, but an unanswered request would fail the test.
    http = TestBed.inject(HttpTestingController);
    http
      .match((request) => request.url.endsWith('/api/settings'))
      .forEach((request) =>
        request.flush({ success: true, data: { currency: 'EGP', id: 1 } }),
      );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function cellText(index: number): string {
    const cells = root().querySelectorAll<HTMLTableCellElement>(
      'td[data-column="productStock"]',
    );
    return (cells[index]?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('always renders the Stock header from the API fields', () => {
    const headers = Array.from(
      root().querySelectorAll<HTMLTableCellElement>('thead th'),
    ).map((th) => th.textContent?.trim());

    expect(headers.some((text) => text?.startsWith('Stock'))).toBe(true);
    expect(root().querySelectorAll('td[data-column="productStock"]')).toHaveLength(2);
  });

  it('renders the total stock, the variant count and the low-stock badge', () => {
    const text = cellText(0);

    expect(text).toContain('12');
    expect(text).toContain('3 variants');
    // low === 0 is not a low-stock warning.
    expect(text).not.toContain('Low stock');
  });

  it('shows the low-stock badge only when the API count is positive', () => {
    fixture.componentRef.setInput('data', [{ id: 3, stock: 0, variants: 1, low: 2 }]);
    fixture.detectChanges();

    expect(cellText(0)).toContain('Low stock');
  });

  it('leaves a null row blank instead of printing undefined or zero', () => {
    // A row with no stock aggregate is an honest empty cell, not a fake 0.
    expect(cellText(1)).toBe('');
  });
});
