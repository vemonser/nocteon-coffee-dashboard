import type { OrderItemResponse } from '../models/order.model';

/** One resolved option of a variant, e.g. Weight = 250g. */
export interface VariantAttribute {
  name: string;
  value: string;
}

/**
 * The variant facts the order page needs, resolved from the product
 * endpoint by `variantId`.
 *
 * <p>The order item itself carries only `variantId` — no weight, no grind,
 * no compare-at price (see API_GAPS.md). The catalog does carry them, so the
 * page joins the two rather than inventing a label.
 */
export interface VariantInfo {
  id: number;
  sku: string | null;
  compareAtPrice: number | null;
  attributes: VariantAttribute[];
}

export interface OrderItemView {
  item: OrderItemResponse;
  variant: VariantInfo | null;
  /** "250g · Whole Bean" — the resolved options, or null when unknown. */
  variantLabel: string | null;
  /** The catalog's compare-at price, only when it is ABOVE the paid unit price. */
  originalUnitPrice: number | null;
}

/**
 * Join the order's lines to the catalog's variants.
 *
 * <p>This is presentation of RECORDED data: the order line's price is what
 * the customer paid, and the variant's compare-at price is the catalog's
 * "regular" price, struck through as a comparison only. It is NOT an
 * order-level discount and is never subtracted from the totals — the order
 * model has no per-line discount field (API_GAPS.md), so none is invented.
 * When the catalog is unavailable the line still renders, without a variant
 * label and without a struck-through price.
 */
export function buildOrderItemViews(
  items: readonly OrderItemResponse[],
  variants: ReadonlyMap<number, VariantInfo>,
): OrderItemView[] {
  return items.map((item) => {
    const variant = variants.get(item.variantId) ?? null;
    const attributes = variant?.attributes ?? [];
    const variantLabel = attributes.length
      ? attributes.map((attribute) => attribute.value).filter(Boolean).join(' · ')
      : null;

    const unitPrice = Number(item.unitPrice ?? 0);
    const compareAt = variant?.compareAtPrice ?? null;
    const hasRegularPrice = compareAt !== null && compareAt > unitPrice;

    return {
      item,
      variant,
      variantLabel,
      originalUnitPrice: hasRegularPrice ? compareAt : null,
    };
  });
}
