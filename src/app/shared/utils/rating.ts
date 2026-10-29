/**
 * FE-14: the two questions a list asks about a product's rating.
 *
 * They are different questions and they must not be conflated:
 *
 *  - {@link hasAnyRating} — "does the API send the fields at all?" decides
 *    whether the COLUMN exists. An older backend omits them, and a column of
 *    blanks (or "undefined" / "NaN") is worse than no column.
 *  - {@link hasCountedRating} — "does THIS row have a rating to show?" decides
 *    the CELL. A product with no approved reviews reports `averageRating: null`
 *    and `reviewCount: 0`, which must render the neutral "No rating" label
 *    rather than "0.0" beside a star (that would claim five one-star reviews
 *    exist).
 *
 * Kept here, pure and shared, so the products list and the data table cannot
 * drift apart, and so both rules are unit-testable without a browser.
 */
export interface RatingValue {
  averageRating?: number | null;
  reviewCount?: number | null;
}

/**
 * True when at least one row carries a rating field — the column is worth
 * rendering at all.
 */
export function hasAnyRating(values: readonly RatingValue[]): boolean {
  return values.some((value) => value.averageRating != null || value.reviewCount != null);
}

/** True when a row has a score AND at least one review behind it. */
export function hasCountedRating(value: RatingValue): boolean {
  return value.averageRating != null && (value.reviewCount ?? 0) > 0;
}
