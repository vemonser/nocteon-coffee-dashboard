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
  /**
   * The catalog's current stock for this variant.
   *
   * <p>The order page shows it only in the RETURNS section, where it is the
   * proof that an approval really put the units back (the read is refreshed
   * after a decision). It is not a claim about what was on the shelf when the
   * order was placed.
   */
  stockQuantity: number | null;
}

export interface OrderItemView {
  item: OrderItemResponse;
  variant: VariantInfo | null;
  /** "250g · Whole Bean" — the resolved options, or null when unknown. */
  variantLabel: string | null;
  /** The per-unit weight in grams, resolved from the variant's Weight option. */
  unitWeightGrams: number | null;
  /** The catalog's compare-at price, only when it is ABOVE the paid unit price. */
  originalUnitPrice: number | null;
  /**
   * The SKU to show: the catalog variant's SKU when it resolved, falling back
   * to the order line's own SKU. The order line and the catalog can carry
   * different SKU formats (see SEED_PROPOSAL.md); showing the catalog's value
   * keeps a product's SKU consistent across the dashboard.
   */
  displaySku: string;
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
function parseWeightGrams(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/([\d.,]+)\s*(كجم|جم|kg|g|gm|gram|kilogram)s?/i);
  if (!match) return null;
  const n = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const unit = match[2].toLowerCase();
  return /ك|k/i.test(unit) ? Math.round(n * 1000) : Math.round(n);
}

function findWeightAttribute(attributes: VariantAttribute[]): VariantAttribute | undefined {
  return (
    attributes.find((attribute) => /weight|الوزن|وزن/i.test(attribute.name)) ??
    attributes.find((attribute) => /([\d.,]+)\s*(كجم|جم|kg|g|gm)s?/i.test(attribute.value ?? ''))
  );
}

/**
 * Join the order's lines to the catalog's variants.
 * …
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

    const weightAttribute = findWeightAttribute(attributes);
    const unitWeightGrams = parseWeightGrams(weightAttribute?.value);

    const unitPrice = Number(item.unitPrice ?? 0);
    const compareAt = variant?.compareAtPrice ?? null;
    const hasRegularPrice = compareAt !== null && compareAt > unitPrice;

    return {
      item,
      variant,
      variantLabel,
      unitWeightGrams,
      originalUnitPrice: hasRegularPrice ? compareAt : null,
      displaySku: variant?.sku ?? item.sku,
    };
  });
}
