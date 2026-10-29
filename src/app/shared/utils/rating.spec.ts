import { describe, expect, it } from 'vitest';
import { hasAnyRating, hasCountedRating } from './rating';

/**
 * FE-14: the rating column degrades in two steps, and each step has its own
 * rule. These tests pin both, because the failure modes are invisible in code
 * review and obvious on screen ("NaN", a column of empty cells, "0.0" stars).
 */
describe('product rating column', () => {
  it('hides the column entirely for a backend that does not send the fields', () => {
    // An older API answers without either field — the list must not grow a
    // column of blanks for it.
    expect(hasAnyRating([{ averageRating: undefined, reviewCount: undefined }])).toBe(false);
    expect(hasAnyRating([{ averageRating: null, reviewCount: null }])).toBe(false);
    // A response that carries neither key at all (the real older payload).
    expect(hasAnyRating([{}, {}])).toBe(false);
    expect(hasAnyRating([])).toBe(false);
  });

  it('shows the column as soon as one row carries a rating', () => {
    expect(
      hasAnyRating([{ averageRating: null, reviewCount: 0 }, { averageRating: 4.3, reviewCount: 12 }]),
    ).toBe(true);
    // A zero count alone is still "the API answered": the column exists and
    // the row gets the neutral label.
    expect(hasAnyRating([{ averageRating: null, reviewCount: 0 }])).toBe(true);
  });

  it('renders a score only when it is backed by at least one review', () => {
    expect(hasCountedRating({ averageRating: 4.3, reviewCount: 12 })).toBe(true);
    expect(hasCountedRating({ averageRating: 5, reviewCount: 1 })).toBe(true);
    // No reviews: null average and a zero count is the neutral state.
    expect(hasCountedRating({ averageRating: null, reviewCount: 0 })).toBe(false);
    // An average with no reviews behind it is contradictory data: refuse to
    // print a star score with "(0)".
    expect(hasCountedRating({ averageRating: 4.3, reviewCount: 0 })).toBe(false);
    expect(hasCountedRating({ averageRating: 4.3, reviewCount: null })).toBe(false);
    expect(hasCountedRating({ averageRating: 0, reviewCount: 0 })).toBe(false);
  });
});
