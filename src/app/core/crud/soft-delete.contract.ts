import { Observable } from 'rxjs';

import { ApiResponse, PageResponse } from '../models/api-response.model';

/**
 * The soft-delete contract, as verified against nocteon-backend on 2026-10-15.
 *
 * Kept deliberately small and isolated so the UI can be written against it without
 * the rest of the app knowing which endpoints happen to exist. Anything the backend
 * does NOT support is declared here as explicitly unavailable rather than faked.
 *
 * ─── What the backend provides ──────────────────────────────────────────────────
 *
 * Trashed rows are a SEPARATE list, not a filter on the main one. Neither
 * `BaseFilterRequest` nor `LookupFilterRequest` has a `deleted` field — there is no
 * `?deleted=false|true|all` anywhere:
 *
 *   GET    /api/dashboard/{entity}            → active rows only  (PageResponse<T>)
 *   GET    /api/dashboard/{entity}/deleted    → trashed rows only (PageResponse<T>)
 *            params: page, size, search, sort, direction
 *            — `isActive` is accepted by the DTO but IGNORED by the /deleted query
 *   PATCH  /api/dashboard/{entity}/{id}/restore
 *            → 200 ApiResponse<Void>
 *            → 404 when the id is live or unknown
 *            → 409 ApiResponse with message `error.duplicate.slug` when a new item
 *              took the slug while this one was trashed (the unique index is on the
 *              live table, and slug generation does not look at trashed rows, so this
 *              is reachable in normal use)
 *   DELETE /api/dashboard/{entity}/{slug}     → soft delete (sets deleted_at)
 *
 * Counts need no dedicated endpoint: `PageResponse.totalElements` from each list call.
 *
 * ─── What the backend does NOT provide ─────────────────────────────────────────
 *
 * 1. PERMANENT DELETE — no purge/hard-delete endpoint exists for any entity
 *    (grep for permanent|purge|hardDelete|forceDelete returns nothing in any
 *    controller). "Delete permanently" therefore has no route to call.
 *
 * 2. `?deleted=all` — cannot list active + trashed in one response.
 *
 * 3. BULK operations — no batch restore / batch delete; every call is per-id.
 *
 * ─── Child records (reported, not changed) ──────────────────────────────────────
 *
 * Soft delete does NOT cascade. A category's products keep their rows, stay
 * `is_active`, and keep appearing in the products list — the product queries only
 * test `p.deleted_at`, never the parent category's. What breaks while the parent is
 * trashed is everything that RESOLVES the parent: category-by-slug lookups return
 * 404 (the entity-level `@SQLRestriction("deleted_at IS NULL")` hides it), so the
 * category detail page and storefront category navigation disappear while its
 * products stay listed. Restoring the parent brings the whole subtree back, because
 * no child state was touched. Child rows are never deleted or cascaded.
 */
export interface SoftDeleteContract<TResponse> {
  /** Trashed rows, paged. `totalElements` is the trash count. */
  getDeleted(params: {
    page?: number;
    size?: number;
    search?: string;
    sort?: string;
    direction?: 'asc' | 'desc';
  }): Observable<ApiResponse<PageResponse<TResponse>>>;

  /** Un-delete by numeric id. Rejects with 404 (not trashed) or 409 (slug conflict). */
  restore(id: number): Observable<ApiResponse<void>>;

  /**
   * NOT IMPLEMENTED — the backend has no permanent-delete endpoint for any entity.
   * Present so callers get an explicit, typed signal instead of a 404 at runtime.
   */
  readonly permanentDeleteSupported: false;
}

/** Shape of a restore failure the UI has to handle differently. */
export type SoftDeleteFailure = 'not-found' | 'slug-conflict' | 'forbidden' | 'unknown';

/** Maps an HTTP status onto the failure kinds above. */
export function classifyRestoreError(status: number): SoftDeleteFailure {
  switch (status) {
    case 404:
      return 'not-found';
    case 409:
      return 'slug-conflict';
    case 401:
    case 403:
      return 'forbidden';
    default:
      return 'unknown';
  }
}