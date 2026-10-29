# FE-09 + FE-10 — plan and change contract

Cycle: Wave 2 (Products), 28 Oct 2026. Source of truth for acceptance:
`docs/frontend-backlog.md` §FE-09, §FE-10.

## Change contract

### Scope

**FE-09 — Variant images**
| Layer | Change |
|---|---|
| DB | `product_variants.image_url text` (V17) |
| API | `ProductVariantRequest.imageUrl`, `ProductVariantResponse.imageUrl`; `POST /api/dashboard/products/variant-images` |
| Dashboard | variants step: upload/replace/remove one image per variant; thumbnail in the variant summary |
| Public API | variant images ride the existing `GET /api/products/{slug}` variants |

**FE-10 — Product tags**
| Layer | Change |
|---|---|
| DB | `product_tags`, `product_tag_translations`, `product_tag_links` (V18) |
| API | tag CRUD `/api/dashboard/product-tags`; `ProductRequest.tagSlugs`; `tags` on the dashboard + public product responses; `?tagSlug=` product filter |
| Dashboard | `/dashboard/product-tags` page (list/add/rename/delete); tags picker in the wizard basic step; tag filter on the products list |

### Non-goals
- Storefront changes (variant gallery swap, tag filter UI). Deferred by decision: that repo
  carries 118 uncommitted files from unrelated work. The contract above is what it consumes;
  recorded as a follow-up in `DECISIONS.md`.
- Tag translations beyond en/ar (the app ships two locales).
- Tag reordering, colours, or tag-scoped merchandising rules.
- Bulk tag assignment on the products list.

### Acceptance criteria
- **AC-1** `product_variants` has `image_url`; create and update persist it, blank stores `null`.
- **AC-2** The variants step uploads one image per variant through the API and shows a thumbnail.
- **AC-3** Removing a variant image clears it on save (null, not empty string).
- **AC-4** `GET /api/products/{slug}` returns `variants[].imageUrl`.
- **AC-5** Tags exist with a stable slug and translated names; slug generated once from the
  English name and never rewritten by a rename.
- **AC-6** The wizard assigns tags; the selection round-trips through edit mode.
- **AC-7** The products list filters by tag, and the filter lives in the URL.
- **AC-8** `GET /api/products/{slug}` returns `tags[]` (`slug`, `name` in the request locale).
- **AC-9** Deleting a tag still used by a product is refused with 409 and the product count.
- **AC-10** Every new string is translated in en + ar; no raw keys, no Title Case, no developer text.

### Affected areas
- Backend: `product` module (entity/DTO/mapper/service/repository/spec), controller, 2 migrations,
  message bundle, tests.
- Dashboard: product models/service/wizard state/variants step/basic step/products list, new
  product-tags feature, routes, sidebar nav, i18n.

### Risk / blast radius
MEDIUM-HIGH. The product read path is the hottest endpoint and already carries a documented N+1
budget (`DashboardListQueryBudgetTest`). A new ManyToMany on `Product` must be `@BatchSize`d and
must not enter the list projection. The tag filter must use `EXISTS`, not a join, or the page
count multiplies.

### Validation plan
- Backend: `./mvnw test` (targeted classes first), then the full suite.
- Dashboard: `npm run build`, `npm run i18n:check`, unit tests.
- Live: API calls against `localhost:8080`; Playwright viewport captures (1440x900) of the
  variants image tile and the tags page, light EN + AR.
- Evidence Gate: `.quality/runs/<ts>/`.

### Rollback
Two additive migrations (nullable column, new tables). Reverting the app leaves them harmless.

## Assumptions to verify
- A tag may be shared by many products and a product may carry several tags (backlog: "assigns
  tags"). Confirmed by the backlog wording.
- Tag administration is product-scoped, so it reuses `product:read|create|update|delete` instead
  of minting a new permission that no seeded role holds (same reasoning that made
  `user:create` unreachable once).

## Coverage map
| AC | Test / evidence |
|---|---|
| AC-1 | `ProductVariantImageTest` (blank → null, value persisted) |
| AC-2 | Playwright capture + manual upload against the live API |
| AC-3 | `ProductVariantImageTest` |
| AC-4 | `PublicProductReadTest` addition |
| AC-5 | `ProductTagServiceTest` (slug generated once) |
| AC-6 | Wizard unit/spec + Playwright |
| AC-7 | `ProductTagFilterTest` (list + filter) |
| AC-8 | `PublicProductReadTest` addition |
| AC-9 | `ProductTagServiceTest` (409 + count) |
| AC-10 | `npm run i18n:check` + screen review |
