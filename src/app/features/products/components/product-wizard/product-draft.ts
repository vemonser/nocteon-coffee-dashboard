/**
 * Draft storage for the product wizard (UX_AUDIT_products.md #7b).
 *
 * The wizard is five steps long; a refresh in the middle must not lose the
 * typing. Only SERIALISABLE values are drafted — files staged for upload live
 * outside the form and stay out of the draft on purpose.
 *
 * Kept as plain functions (no Angular) so the storage rules — the key shape,
 * the "empty draft is no draft" rule, and "storage failure is never a blocker"
 * — are testable without a TestBed.
 */

export interface ProductDraft {
  value: unknown;
  savedAt: string;
}

const PREFIX = 'products.wizard.draft.v1:';

/** One draft per product; the create flow shares the 'new' slot. */
export function draftKey(slug: string | null): string {
  return `${PREFIX}${slug ?? 'new'}`;
}

export function saveProductDraft(slug: string | null, value: unknown, now: Date = new Date()): boolean {
  try {
    localStorage.setItem(draftKey(slug), JSON.stringify({ value, savedAt: now.toISOString() }));
    return true;
  } catch {
    /* storage full / private mode: a draft is a convenience, never a blocker */
    return false;
  }
}

export function loadProductDraft(slug: string | null): ProductDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductDraft;
    // An empty or corrupt draft is no draft — never offer an empty restore.
    return parsed && parsed.value && parsed.savedAt ? parsed : null;
  } catch {
    return null;
  }
}

export function clearProductDraft(slug: string | null): void {
  try {
    localStorage.removeItem(draftKey(slug));
  } catch {
    /* nothing to clean */
  }
}
