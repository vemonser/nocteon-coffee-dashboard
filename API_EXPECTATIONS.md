# API expectations (frontend contract)

Derived by reading the frontend services in `src/app`. Backend status checked against
`nocteon-backend` controllers (and live calls where noted). `[exists]` = endpoint present; [done]
`[missing]` = no backend endpoint; `[mismatch]` = present but contract differs.

## Notifications

Base: `/api/dashboard/notifications`

- `GET /api/dashboard/notifications` (list) — [exists, mismatch] [done]
  - Frontend sends query params: `page`, `size`, `unreadOnly`.
  - Backend expects: `cursor`, `limit`, `unreadOnly`. Returns `NotificationCursorResponse` with `content`, `nextCursor`, `hasMore`.
  - UI reads: `data.content[]` (`id`, `type`, `params`, `entityType`, `entityId`, `createdAt`, `readAt`), `data.last/totalElements/totalPages` (not returned).
  - Breaks: notifications list never loads through the cursor contract; page/size ignored.
- `GET /api/dashboard/notifications/unread-count` — [exists] [done]
  - Response: `ApiResponse<Long>` (`data`).
  - UI reads: `data` (number).
- `POST /api/dashboard/notifications/{id}/read` (mark read) — [exists, mismatch] [done] (backend also accepts PATCH)
  - Frontend calls `PATCH`; backend is `POST`. UI handles 404 (NotificationNotFoundException) via apiError toast.
- `POST /api/dashboard/notifications/{id}/unread` (mark unread) — [exists, mismatch] [done] (backend also accepts PATCH)
  - Frontend calls `PATCH`; backend is `POST`.
- `POST /api/dashboard/notifications/read-all` (read all) — [exists, mismatch] [done] (backend also accepts PATCH)
  - Frontend calls `PATCH /read-all`; backend is `POST /read-all`.
- `DELETE /api/dashboard/notifications/{id}` (delete) — [exists] [done]
  - UI feature: remove notification; on error restores list + unread count.

Error codes handled by UI: `notify.errorFallback` (generic), 404 on mark/delete.

## Nav counts

- `GET /api/dashboard/nav-counts` — [exists, mismatch] [done] (backend now returns `contactUnread` in addition to `unreadMessages`)
  - Response: `ApiResponse<Map<String,Long>>` with keys `openOrders`, `abandonedCarts`, `pendingReviews`, `unreadMessages`.
  - UI reads (NavCountsService): `ordersOpen|openOrders|orders`, `cartsAbandoned|abandonedCarts|carts`, `reviewsPending|pendingReviews|reviews`, `contactUnread|unreadContact|contactMessages|contact`.
  - Mismatch: backend `unreadMessages` is not in the frontend allow-list, so the contact badge never populates.
  - Breaks: sidebar badges for contact messages.

## Products list (stock fields)

- `GET /api/dashboard/products` — [exists] [done] (backend now also sends `variantsCount` alias)
  - UI reads from each product: `totalStock`, `variantCount`, `lowStockVariantCount` (plus `variantsCount` alias used by UI but backend sends `variantCount`).
  - Breaks: stock column stays hidden because `variantsCount` is never populated (`p.variantsCount` is undefined; backend field is `variantCount`).
  - `?tagSlug=<slug>` filters by a merchandising tag (FE-10). Implemented in the dashboard JPQL as well as the public specification — the dashboard list does not use the specification.

## Variant images (FE-09)

- `POST /api/dashboard/products/variant-images` — [exists] (multipart `file`) → `{ url }`; `product:create|update`.
  - Same validation as the story image: jpeg/png/gif/webp, 5 MB, magic bytes.
- `GET /api/products/{slug}` → `variants[].imageUrl` — [exists]. Nullable; `null` means "use the product gallery".
- Variant create/update accept `imageUrl`; blank is stored as `null`.

## Product tags (FE-10)

Base: `/api/dashboard/product-tags`

- `GET /api/dashboard/product-tags` — [exists] `product:read`. Returns every tag with its translations (`{ language, title }`).
- `POST /api/dashboard/product-tags` — [exists] `product:create`. Body `{ translations: [{ language, name }] }` (en + ar required); the slug is generated from the English name.
- `PUT /api/dashboard/product-tags/{id}` — [exists] `product:update`. Renames translations only; the slug never changes.
- `DELETE /api/dashboard/product-tags/{id}` — [exists] `product:delete`. 409 `error.productTag.inUse` with the product count while products still carry it.
- Product create/update accept `tagSlugs: string[]`; an unknown slug is rejected (404), not dropped.
- `GET /api/products/{slug}` → `tags[] = { slug, name }`; `GET /api/products?tagSlug=<slug>` filters the public list.

## Product option values

Base: `/api/dashboard/product-options`

- `GET /api/dashboard/product-options` — [exists] [done]
- `GET /api/dashboard/product-options/{optionId}` — [exists] [done]
- `POST /api/dashboard/product-options` — [exists] [done]
- `PUT /api/dashboard/product-options/{optionId}` — [exists] [done]
- `DELETE /api/dashboard/product-options/{optionId}` — [exists] [done]
- `POST /api/dashboard/product-options/{optionId}/values` (add value) — [exists] [done]
- `PATCH /api/dashboard/product-options/{optionId}/values/{valueId}` (edit value) — [exists] [done]
- `PUT /api/dashboard/product-options/{optionId}/values/order` (reorder) — [exists] [done]
- `DELETE /api/dashboard/product-options/{optionId}/values/{valueId}` (delete value) — [exists] [done]
  - On conflict returns 409 `OPTION_VALUE_IN_USE` with `data.variantCount` — [exists]. [done]
- `GET /api/dashboard/product-options/{optionId}/values/{valueId}/usage` (usage count) — [missing] [done] (backend now implements; returns `{ count }`)
  - UI calls it (`getValueUsageCount`); breaks the pre-delete usage count display.
- `appliesTo` field on option — [exists] (backend returns `Set<ProductType>`). [done]

## Roles and permissions

- `GET /api/dashboard/roles` — [exists] [done]
- `GET /api/dashboard/roles/{name}` — [exists] [done]
- `POST /api/dashboard/roles` — [exists] [done]
- `PUT /api/dashboard/roles/{name}` — [exists] [done]
- `DELETE /api/dashboard/roles/{name}` — [exists] [done]
- `GET /api/dashboard/permissions` — [exists] (returns slug/resource/action list; frontend uses a static `ALL_PERMISSIONS` list instead of calling it). [done]
- `PUT /api/dashboard/users/{id}/role` (change role, returns permission diff) — [exists] [done]

## Users summary

- `GET /api/dashboard/users` returns `ApiResponse<PageResponse<UserResponse>>` with `summary` — [exists] [done]
  - Summary fields read by UI: `total`, `admins`, `customers`, `blocked`, `unverified`.
  - Backend also returns `byRole` (list of `{role, count}`) — [exists], but frontend `ListSummary` does not declare `byRole`, so the by-role breakdown is ignored. [partial] (backend now sends both `userCount` and `count`; frontend must declare `byRole` to use it)
  - UI feature that breaks when missing: role cards counts on the Users list.

## Contact replies

- `GET /api/dashboard/contact-messages` — [exists] [done]
- `GET /api/dashboard/contact-messages/{id}` — [exists] [done]
- `GET /api/dashboard/contact-messages/stats/summary` — [exists] [done]
- `GET /api/dashboard/contact-messages/unread` — [exists] [done]
- `GET /api/dashboard/contact-messages/status/{status}` — [exists] [done]
- `POST /api/dashboard/contact-messages/{id}/reply` (reply) — [exists] [done]
  - Body: `{ replyContent }`. Frontend sends `{ replyContent }`.
- `POST /api/dashboard/contact-messages/{id}/resend-email` — [exists] [done]
- `PATCH /api/dashboard/contact-messages/{id}/read` — [exists] [done]
- `PATCH /api/dashboard/contact-messages/{id}/archive` — [exists] [done]
- `DELETE /api/dashboard/contact-messages/{id}` — [exists] [done]
