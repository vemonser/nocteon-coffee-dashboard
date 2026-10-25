// Option applicability helper.
//
// The backend now exposes `ProductOption.appliesTo` (a set of product types,
// default "all"). Prefer it; fall back to the temporary config below only when
// the field is absent (older backend). The temporary config can be removed once
// all backends return appliesTo.

// TEMPORARY CONFIG — remove once every backend returns appliesTo.
// TODO: delete this fallback and rely on option.appliesTo only.
const TEMP_APPLICABILITY: Record<string, string[]> = {
  COFFEE: ['weight', 'grind'],
  EQUIPMENT: ['size'],
};

export function optionAppliesTo(option: { slug: string; appliesTo?: string[] }, productType: string | null | undefined): boolean {
  const applies = option.appliesTo && option.appliesTo.length ? option.appliesTo : null;
  if (applies) {
    return applies.includes('ALL') || applies.includes(productType ?? '') || applies.includes('*');
  }
  const allowed = TEMP_APPLICABILITY[productType ?? ''] ?? [];
  if (allowed.length === 0) return true;
  return allowed.includes(option.slug);
}

export function filterOptionsByProductType<T extends { slug: string; appliesTo?: string[] }>(
  options: T[],
  productType: string | null | undefined,
): T[] {
  if (!productType) return options;
  return options.filter((o) => optionAppliesTo(o, productType));
}
