# Remaining work (after FE-01..FE-12 + the KNOWN_ISSUES pass)

Last updated: 29 Oct 2026. `main` is on both repos and carries everything through FE-12, GLOBAL-04, PRODUCTS-04/05/06/07, GLOBAL-07/08, SEARCH-01, VERIFY-01/02 (frontend branches not yet merged — see below).

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
- [ ] FE-16 Invoice PDF + resend confirmation (1d) — `GET /api/dashboard/orders/{id}/invoice` + resend with `email_log`.
- [ ] FE-17 Notify the customer on status change (1d) — transactional email, toggle "no email", failures in `email_log`.
- [ ] FE-18 Bulk status update (0.5d) — allowed transitions only, per-row failure list.
- [ ] FE-19 Orders CSV export (0.5d) — current filter, UTF-8 BOM, row count in the button.
- [ ] FE-20 Returns / RMA (3d, optional) — depends on FE-13.

## 4) Backlog — Wave 4 (Shell, look, cross-cutting)
- [ ] FE-21 Public storefront smoke (0.5d) — Playwright probe of every public read endpoint.
- [ ] FE-22 Audit log page (1d) — `settings/audit`, filters, JSON detail drawer, paginated.
- [ ] FE-23 Real-time notifications (2d) — SSE push of unread count + items, poll fallback.
- [ ] FE-24 Export menu completion (0.5d) — implement or remove the disabled PDF option.
- [ ] FE-25 Shell pass (design) (1d) — sidebar density, tablet 768, mobile drawer focus trap, theme toggle announces.
- [ ] FE-26 Orders / products visual pass (design) (1d) — density, columns, states at 1440/375, light/dark, EN/AR.
- [ ] FE-27 States audit (design + UX) (1d) — empty/skeleton/error+retry on every page, Playwright blank-body check.

## 5) Pre-existing e2e failures (2)
- `dashboard-states.spec.ts` — stale "could not load" assertion (now "could not be loaded"); range selector does not restore `?days=` on reload.

## 6) Frontend branches not yet merged into `main`
- `feat/global-08-permission-aware-ui` (f54c60f3)
- `feat/products-04-chip-multiselect` (54df947d)
- `fix/verify-01-contact-reply` (c606d179)
- `feat/search-01-global-search-audit` (14f9a4be, 13bf39e6)
- `feat/products-07-media-tile-table` (6b5b123e)
- `feat/verify-02-frontend` (16ea4842)
- `feat/verify-02-backend` (backend, 76a6218, d936eda)

## 7) needs-backend (filed, fallbacks in place) — now resolved
All four are done in the backend (GLOBAL-07, NOTIF-01, OPTIONS-04, PRODUCTS-06). The frontend fallbacks can be removed in a cleanup pass.

## Suggested next order
FE-14 + FE-15 (1 day) → FE-18 + FE-19 (1 day) → FE-25 → FE-26 → FE-27 (3 days) → storefront pass → FE-13 → FE-16 → FE-17 → FE-21 → FE-22 → FE-23 → FE-24 → FE-20 (optional).
EOF
echo "written"