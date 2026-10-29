# Remaining work (after FE-01..FE-12 + the KNOWN_ISSUES pass)

Last updated: 29 Oct 2026 (evening). `main` on both repos is pushed and green: build, `i18n:check`, unit 321/321, `e2e/dashboard-states` 5/5. All feature branches are merged — see §6.

## 1) Storefront (contracts live, UI not consumed)
Branch `feat/storefront-contracts` was force-pushed to `main` (the previous `origin/main` `26520e1 major update` is preserved as `backup/storefront-major-update`).
- [ ] Variant gallery: swap the main image on variant selection (use `variants[].imageUrl`, fall back to the gallery).
- [ ] Tag filter: render `?tagSlug=` from the public `/api/product-tags` list.
- [ ] Related block: use `product.relatedProducts` (curated cards) instead of the same-category guess.

## 2) Backlog — Wave 2 (Products)
- [ ] FE-13 Inventory movement log (1.5d) — every stock change writes before/after + actor + reason; manual adjustment asks for a reason.
- [ ] FE-14 Rating aggregate on product cards (0.5d) — `averageRating` + `reviewCount` on the card response.
- [ ] FE-15 Barcode / GTIN on variants (0.5d) — unique when set, searchable, in CSV export.

## 3) Backlog — Wave 3 (Orders)
- [ ] FE-16 Invoice PDF + resend confirmation (1d) — `GET /api/dashboard/orders/{id}/invoice` + resend with `email_log`. The print stylesheet (`?print=1`) is the only invoice today.
- [ ] FE-17 Notify the customer on status change — the FRONTEND half exists (the status dialog has a "Notify the customer by email" toggle and sends `notifyCustomer`); what is missing is the transactional email plus `email_log` on the backend.
- [ ] FE-18 Bulk status update (0.5d) — `bulkChangeStatus` only opens the first selected order's dialog, so there is no real bulk path yet.
- [~] FE-19 Orders CSV export — DONE except one acceptance clause: it exports the current filter (not just the page) with a UTF-8 BOM already; the button does not state the row count.
- [ ] FE-20 Returns / RMA (3d, optional) — depends on FE-13.

## 4) Backlog — Wave 4 (Shell, look, cross-cutting)
- [ ] FE-21 Public storefront smoke (0.5d) — Playwright probe of every public read endpoint.
- [ ] FE-22 Audit log page (1d) — `settings/audit`, filters, JSON detail drawer, paginated.
- [ ] FE-23 Real-time notifications (2d) — SSE push of unread count + items, poll fallback.
- [ ] FE-24 Export menu completion (0.5d) — implement or remove the disabled PDF option.
- [ ] FE-25 Shell pass (design) (1d) — sidebar density, tablet 768, mobile drawer focus trap, theme toggle announces.
- [ ] FE-26 Orders / products visual pass (design) (1d) — density, columns, states at 1440/375, light/dark, EN/AR.
- [ ] FE-27 States audit (design + UX) (1d) — empty/skeleton/error+retry on every page, Playwright blank-body check.

## 5) Pre-existing e2e failures — FIXED 29 Oct 2026
`e2e/dashboard-states.spec.ts` is 5/5. Test 1's assertion hardcoded "could not load" while the first alert says "The attention queue could not be loaded"; test 3 failed for a real reason — the toolbar wrote `?days=` but nothing read it back, so a reload reset the reader to 30 days (the home now restores it, and back/forward too).

## 6) Frontend branches — all merged into `main` (29 Oct 2026)
GLOBAL-08, PRODUCTS-04, VERIFY-01, SEARCH-01, PRODUCTS-07, VERIFY-02 (frontend) and VERIFY-02 (backend) are all on `main`; `main` is pushed on both repos. Still local and NOT merged, deliberately:
- `feat/fe-11-related-products` — its two commits are already in `main` (one patch-identical, one a two-line `KNOWN_ISSUES.md` edit that `main` already carries).
- `order-details-pass-1` (Oct 24) — superseded by the RBAC UI pass; `permission.service.ts`, `permission.utils.ts` and the matrix are on `main`.
- `unsaved-guard` — every commit is patch-identical to one already in `main`.
- `backup/fe-01-docs-old`, `backup/fe-07-old` — snapshots, keep as-is.
Ten stashes are still parked on `main` (including a permission-gating WIP); they are not on `main` and were left alone.

## 7) needs-backend (filed, fallbacks in place) — now resolved
All four are done in the backend (GLOBAL-07, NOTIF-01, OPTIONS-04, PRODUCTS-06). The frontend fallbacks can be removed in a cleanup pass.

## 8) Fixed while verifying this list (29 Oct 2026)
- `common.chipMultiselect.*` never existed in en/ar: every Add button in the Tasting notes and Pairings steps rendered the raw key. Added, and the raw-control baseline refreshed (PRODUCTS-04).
- The two wizard steps derived `selected` with a `computed()` over a FormArray's `.value`, which is not a signal: a picked note never became a chip, its Add button never disabled, and the next pick silently replaced it. Now `toSignal(form.valueChanges)`; guarded by the new `e2e/product-wizard-chips.spec.ts`.
- The chip remove label lost its item ("Remove" for every chip) because a `{{name}}` placeholder was translated without parameters; the component now translates `remove`/`counter` with their params.

## Suggested next order
FE-14 + FE-15 (1 day) → FE-18 + FE-19 (1 day) → FE-25 → FE-26 → FE-27 (3 days) → storefront pass → FE-13 → FE-16 → FE-17 → FE-21 → FE-22 → FE-23 → FE-24 → FE-20 (optional).
EOF
echo "written"