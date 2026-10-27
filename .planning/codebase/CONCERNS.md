---
last_mapped_commit: 2c5b82b097aec293aee8a62c7d6ea81070ac203e
last_mapped_at: 2026-10-26
---
<!-- refreshed: 2026-10-26 -->

# Concerns

**Analysis Date:** 2026-10-26

## Technical Debt

- **Inconsistent feature service base class:** `ProductService` (`src/app/features/products/services/product.service.ts`) reimplements CRUD independently instead of extending `BaseCrudService`, duplicating pagination caps and request building.
- **Mixed component location conventions:** list/detail components live in varying paths (`features/<x>/components/...` vs nested `features/<x>/components/<name>/...`), making discovery inconsistent.
- **Permission rollout incomplete:** permission-aware UI exists mainly on Users/Roles; `KNOWN_ISSUES.md` GLOBAL-08 notes only ~35 template `*appCan` usages.
- **Unverified UI flows:** media tile hover actions, variants table view, chip-multiselect unification, roles editor flow, global search palette (KNOWN_ISSUES PRODUCTS-07, PRODUCTS-04, VERIFY-02, SEARCH-01).

## Known Issues (from KNOWN_ISSUES.md)

- GLOBAL-04 [open]: dialog footer button order inconsistent across dialogs.
- GLOBAL-07 [needs-backend]: sidebar count badges depend on `/api/dashboard/nav-counts`.
- GLOBAL-08 [open]: permission-aware UI not rolled out to every page.
- PRODUCTS-04 [open]: tasting notes and pairings use different UIs.
- PRODUCTS-06 [needs-backend]: variant options not filtered by product type until backend supplies `appliesTo`.
- OPTIONS-04 [needs-backend]: deleting option values used by variants lacks backend protection.
- NOTIF-01 [needs-backend]: notification producers missing.
- VERIFY-01/02 [open]: contact reply semantics and roles editor flow unverified.
- SEARCH-01 [open]: global search palette not audited.

## Backend Dependencies (API_GAPS.md)

- Many frontend features wait on backend contracts (order status history, shipment ETA, refunds, nav counts, notification producers, option usage counts).
- Frontend builds safe fallbacks and documents gaps in `API_GAPS.md`.

## Testing Gaps

- No unit tests for many feature components; 32 spec files concentrated in orders, reviews, users, shared.
- E2E suites are serial (workers=1) due to login rate limits; long runtimes.
- Some routes not covered by QA harness (global search, review dialog final audit pending).
- Evidence manifests use string evidence entries, incompatible with installed software-factory evidence-gate validator (EVIDENCE_MALFORMED).

## Performance

- Large bundles possible due to ApexCharts, Quill, and many UI primitives; production budget 1.6MB error.
- Evidence capture produces large artifacts (screenshots, results.json) and heavy `.planning/graphs` files (3–4MB each).

## Security

- JWT access token held in memory; refresh token in httpOnly cookie.
- `authInterceptor` handles 401; 403 de-duplicated toast.
- Secret scan required before committing generated codebase docs; no secrets found in current map.
- Playwright traces capture credentials in plaintext; `test-results/` is gitignored.

## Fragile Areas

- `BaseListComponent` is large and central; changes affect many list pages.
- Dirty-tracking and unsaved-changes guard are global and sensitive to form state.
- i18n sentence-case and placeholder checks enforced by `npm run i18n:check`.
- RTL/LTR layout relies on logical CSS; regressions possible in new components.

## Operational Concerns

- `.planning/graphs/` files are very large and tracked; may slow git operations.
- Multiple overlapping workflow systems (GSD, Superpowers SDD, manual branch reports) with no single canonical task state yet.
- GSD not initialized for this repo (no `STATE.md`/`ROADMAP.md`), so GSD resumability is unavailable until initialization.

---

*Concerns analysis: 2026-10-26*
