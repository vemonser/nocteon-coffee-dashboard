/**
 * FE-15: the products CSV, built as text so the rules can be tested without a browser.
 *
 * <p>Mirrors the orders and broadcasts exports: literal English headers, RFC-4180 escaping, and
 * the UTF-8 BOM added by the caller ({@link withUtf8Bom}) so Excel opens an Arabic product name
 * as UTF-8 rather than as Latin-1.
 *
 * <p>The barcode column is the reason this exists as a function: a product with no barcoded
 * variant must render an EMPTY cell, not "undefined", not "null" and not a dash — and a product
 * whose variants each carry a code lists every one of them, because the export is per product
 * while the code is per variant.
 */

/** One list row, as the products API answers it (the export reads the card shape directly). */
export type ProductCsvRow = Record<string, unknown>;

/** Barcodes keyed by product id, as `GET /variant-barcodes` returns them. */
export type BarcodesByProductId = Record<string, string[]>;

export const PRODUCTS_CSV_HEADER = [
  'Product',
  'Slug',
  'Type',
  'Category',
  'Min price',
  'Max price',
  'Stock',
  'Variants',
  'Status',
  'Featured',
  'Barcode',
] as const;

/** Separates the barcodes of one product's variants inside one cell. */
const BARCODE_SEPARATOR = ' | ';

/** RFC-4180: quote when the value holds a separator, a quote or a newline. */
export function escapeCsvValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The whole file, without the BOM.
 *
 * @param money formats one amount with the app's shared currency helper — passed in rather than
 *              imported so a spec can assert the exact cell without a locale setup
 */
export function buildProductsCsv(
  rows: ProductCsvRow[],
  barcodes: BarcodesByProductId,
  money: (value: unknown) => string,
): string {
  const moneyCell = (value: unknown): string => (value === null || value === undefined ? '' : money(value));

  const lines = [PRODUCTS_CSV_HEADER.join(',')];
  for (const row of rows) {
    const id = row['id'];
    const productBarcodes = id == null ? [] : (barcodes[String(id)] ?? []);
    lines.push(
      [
        row['name'] ?? '',
        row['slug'] ?? '',
        row['productType'] ?? '',
        row['categorySlug'] ?? '',
        moneyCell(row['minPrice']),
        moneyCell(row['maxPrice']),
        row['totalStock'] ?? '',
        row['variantsCount'] ?? row['variantCount'] ?? '',
        (row['active'] ?? row['isActive'] ?? true) ? 'Enabled' : 'Disabled',
        row['featured'] ? 'Yes' : 'No',
        productBarcodes.join(BARCODE_SEPARATOR),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }
  return lines.join('\n');
}

/**
 * The file as it is written: the BOM first, so Excel reads the bytes as UTF-8.
 *
 * <p>It is a separate step because the BOM is invisible in a diff and easy to lose in a refactor —
 * this way the spec asks for it by name.
 */
export function withUtf8Bom(csv: string): string {
  return '\uFEFF' + csv;
}
