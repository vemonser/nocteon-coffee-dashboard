// TEMPORARY CONFIG — remove once the backend exposes an `appliesTo` field on
// ProductOption (see DECISIONS.md "Needs backend"). Until then this is the
// single source of truth for which product options apply to which product type.
//
// TODO: delete this file and read option.appliesTo from the API instead.

export const PRODUCT_OPTION_APPLICABILITY: Record<string, string[]> = {
  COFFEE: ['weight', 'grind'],
  EQUIPMENT: ['size'],
};

export function applicableOptionSlugs(productType: string | null | undefined): string[] {
  if (!productType) return [];
  return PRODUCT_OPTION_APPLICABILITY[productType] ?? [];
}

export function filterOptionsByProductType<T extends { slug: string }>(
  options: T[],
  productType: string | null | undefined,
): T[] {
  const allowed = new Set(applicableOptionSlugs(productType));
  if (allowed.size === 0) return options;
  return options.filter((o) => allowed.has(o.slug));
}
