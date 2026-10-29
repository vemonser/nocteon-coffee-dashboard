import { describe, expect, it } from 'vitest';
import {
  PRODUCTS_CSV_HEADER,
  buildProductsCsv,
  escapeCsvValue,
  withUtf8Bom,
} from './products-csv';

/**
 * FE-15: the barcode column of the products export.
 *
 * <p>The column is the whole point of the change, and it has three states that are easy to get
 * wrong silently: a product with one barcode, a product whose variants each carry one, and a
 * product with none — the last must be an EMPTY cell, never "undefined" or "null" (the dashboard
 * rule against developer text applies to a file the admin will open in Excel too).
 */
describe('products CSV export (FE-15)', () => {
  const money = (value: unknown) => `EGP ${value}`;

  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 7,
    name: 'Yirgacheffe',
    slug: 'yirgacheffe',
    productType: 'COFFEE',
    categorySlug: 'coffee',
    minPrice: 650,
    maxPrice: 650,
    totalStock: 12,
    variantsCount: 2,
    isActive: true,
    featured: false,
    ...overrides,
  });

  it('names the barcode column in the header, next to the rest of the row', () => {
    const csv = buildProductsCsv([row()], {}, money);
    expect(csv.split('\n')[0]).toBe(PRODUCTS_CSV_HEADER.join(','));
    expect(PRODUCTS_CSV_HEADER).toContain('Barcode');
  });

  it('writes the variant barcode in the row', () => {
    const csv = buildProductsCsv([row()], { '7': ['4006381333931'] }, money);
    const cells = csv.split('\n')[1].split(',');
    expect(cells[cells.length - 1]).toBe('4006381333931');
  });

  it('lists every barcode of a product whose variants each carry one', () => {
    const csv = buildProductsCsv([row()], { '7': ['4006381333931', '4006381333948'] }, money);
    expect(csv.split('\n')[1]).toContain('4006381333931 | 4006381333948');
  });

  it('leaves the cell empty when no variant has a barcode', () => {
    const csv = buildProductsCsv([row()], {}, money);
    const line = csv.split('\n')[1];
    expect(line.endsWith(',')).toBe(true);
    expect(line).not.toContain('undefined');
    expect(line).not.toContain('null');
  });

  it('keeps the UTF-8 BOM so Excel reads Arabic names correctly', () => {
    expect(withUtf8Bom('a,b')).toBe('\uFEFFa,b');
  });

  it('quotes values that would otherwise break the columns', () => {
    expect(escapeCsvValue('Yirgacheffe, 250g')).toBe('"Yirgacheffe, 250g"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue(null)).toBe('');
    const csv = buildProductsCsv([row({ name: 'Yirgacheffe, 250g' })], { '7': ['abc'] }, money);
    expect(csv.split('\n')[1].startsWith('"Yirgacheffe, 250g",')).toBe(true);
  });

  it('reports the status in the product vocabulary, not a raw boolean', () => {
    const enabled = buildProductsCsv([row()], {}, money).split('\n')[1];
    const disabled = buildProductsCsv([row({ isActive: false })], {}, money).split('\n')[1];
    expect(enabled).toContain('Enabled');
    expect(disabled).toContain('Disabled');
  });
});
