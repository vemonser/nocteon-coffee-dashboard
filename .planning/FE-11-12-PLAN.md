# FE-11 + FE-12 — plan and change contract

Cycle: Wave 2 (Products), 29 Oct 2026. Source of truth for acceptance:
`docs/frontend-backlog.md` §FE-11, §FE-12. Base: `main` (which now carries FE-01..FE-10).

## Scope

**FE-11 — Related / upsell products**
| Layer | Change |
|---|---|
| DB | `product_relations(product_id, related_product_id, position)` (V19) |
| API | `ProductRequest.relatedProductSlugs` (max 6); `relatedProducts` on the dashboard response (slug + name + image) and on the public product response (cards); self-reference and >6 rejected |
| Dashboard | a "You may also like" section in the wizard's pairings step: search the catalogue, pick up to 6, chips with remove |
| Public API | the block is empty (empty list) when nothing is picked — the storefront hides it |

**FE-12 — Duplicate product**
| Layer | Change |
|---|---|
| API | `POST /api/dashboard/products/{slug}/duplicate` (product:create) → the new product |
| Service | copies translations, variants (new SKUs, stock 0), media, coffee details, tasting notes, pairings, brewing methods, tags, related products; slug `<slug>-copy`, inactive |
| Dashboard | the existing "Duplicate" row action calls it and opens the copy in the wizard (the dead `/products/:slug/duplicate` route is removed) |

## Non-goals
- Storefront rendering of the related block (repo has unrelated uncommitted work; the contract is exposed — same decision as FE-09/FE-10).
- Ordering UI for related products (they keep the order they were added in).
- Duplicating orders, reviews, journal links or AI documents.

## Acceptance criteria
- **AC-1** A product stores up to 6 ordered related products; a 7th, a self-reference, or an unknown slug is rejected.
- **AC-2** The wizard picks related products and the selection round-trips through edit mode.
- **AC-3** `GET /api/products/{slug}` returns `relatedProducts[]` as cards, empty when none are set.
- **AC-4** Duplicating creates a product with a `<slug>-copy` slug, inactive, with translations, variants, media and relations copied and its own variant SKUs.
- **AC-5** The duplicate does not double inventory: copied variants start at stock 0.
- **AC-6** The row action opens the wizard on the copy.

## Risk / blast radius
MEDIUM. New self-referencing many-to-many on `Product` (must stay `@BatchSize`d and out of the
list projection). Duplicate writes a full product graph — the risk is a partial copy or a
violated unique constraint (SKU/slug), so it runs in one transaction and is covered by a
DB-backed test.

## Validation
- Backend: targeted tests, then the full suite.
- Dashboard: build, unit tests, i18n check.
- Live: Playwright (wizard picker screenshot; duplicate row action creates and opens the copy),
  API checks, Evidence Gate per task.

## Coverage map
| AC | Test / evidence |
|---|---|
| AC-1 | `ProductRelationServiceTest` (+ request validation) |
| AC-2 | wizard state spec + Playwright |
| AC-3 | `RelatedProductsResponseMapperTest` |
| AC-4 | `ProductDuplicateIntegrationTest` (real DB, rolled back) |
| AC-5 | `ProductDuplicateIntegrationTest` |
| AC-6 | Playwright row-action run + screenshot |
