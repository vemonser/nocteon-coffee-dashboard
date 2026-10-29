// Option applicability.
//
// The API returns `ProductOption.appliesTo`: the product types the option is
// valid for (a set of `ProductType` values). The options endpoint already
// filters on it when the wizard asks for a product type; this helper keeps the
// rule in one place for the list the wizard holds.
//
// An option WITHOUT the field (or with an empty set) applies to every type.
// That is the backend's own rule (`appliesTo IS EMPTY` matches every type), so
// an older row can never disappear from the picker — a filter that let a
// missing field mean "applies to nothing" would silently hide valid options.

export interface ApplicableOption {
  slug?: string;
  appliesTo?: string[] | null;
}

export function optionAppliesTo(
  option: ApplicableOption,
  productType: string | null | undefined,
): boolean {
  const applies = option.appliesTo;
  if (!applies || applies.length === 0) return true;
  if (!productType) return true;
  return applies.includes(productType);
}

export function filterOptionsByProductType<T extends ApplicableOption>(
  options: T[],
  productType: string | null | undefined,
): T[] {
  if (!productType) return options;
  return options.filter((option) => optionAppliesTo(option, productType));
}
