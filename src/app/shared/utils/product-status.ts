/**
 * The one product-status mapper.
 *
 * <p>The product list endpoint serialises the flag as `active`; the category
 * detail's product cards were typed against `isActive` and therefore read
 * `undefined` for every row — which the table rendered as "Disabled" while the
 * products list said "Enabled". Both surfaces now read through this function so
 * they cannot disagree again.
 *
 * <p>A row that carries NEITHER field still defaults to active: an older
 * payload without the flag is not evidence that the product is disabled.
 */
export interface ProductStatusFields {
  active?: boolean | null;
  isActive?: boolean | null;
}

export function isProductActive(row: ProductStatusFields | null | undefined): boolean {
  if (!row) return false;
  return row.active ?? row.isActive ?? true;
}
