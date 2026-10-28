# API expectations (frontend contract)

Derived by reading the frontend services in `src/app`. Backend status checked against
`nocteon-backend` controllers (and live calls where noted). `[exists]` = endpoint present;
`[missing]` = no backend endpoint; `[mismatch]` = present but contract differs.

## Notifications

Base: `/api/dashboard/notifications`

- `GET /api/dashboard/notifications` (list) — [exists, mismatch]
  - Frontend sends query params: `page`, `size`, `unreadOnly`.
  - Backend expects: `cursor`, `limit`, `unreadOnly`. Returns `NotificationCursorResponse` with `content`, `nextCursor`, `hasMore`.
  - UI reads: `data.content[]` (`id`, `type`, `params`, `entityType`, `entityId`, `createdAt`, `readAt`), `data.last/totalElements/totalPages` (not returned).
  - Breaks: notifications list never loads through the cursor contract; page/size ignored.
- `GET /api/dashboard/notifications/unread-count` — [exists]
  - Response: `ApiResponse<Long>` (`data`).
  - UI reads: `data` (number).
- `POST /api/dashboard/notifications/{id}/read` (mark read) — [exists, mismatch]
  - Frontend calls `PATCH`; backend is `POST`. UI handles 404 (NotificationNotFoundException) via apiError toast.
- `POST /api/dashboard/notifications/{id}/unread` (mark unread) — [exists, mismatch]
  - Frontend calls `PATCH`; backend is `POST`.
- `POST /api/dashboard/notifications/read-all` (read all) — [exists, mismatch]
  - Frontend calls `PATCH /read-all`; backend is `POST /read-all`.
- `DELETE /api/dashboard/notifications/{id}` (delete) — [exists]
  - UI feature: remove notification; on error restores list + unread count.

Error codes handled by UI: `notify.errorFallback` (generic), 404 on mark/delete.

## Nav counts

- `GET /api/dashboard/nav-counts` — [exists, mismatch]
  - Response: `ApiResponse<Map<String,Long>>` with keys `openOrders`, `abandonedCarts`, `pendingReviews`, `unreadMessages`.
  - UI reads (NavCountsService): `ordersOpen|openOrders|orders`, `cartsAbandoned|abandonedCarts|carts`, `reviewsPending|pendingReviews|reviews`, `contactUnread|unreadContact|contactMessages|contact`.
  - Mismatch: backend `unreadMessages` is not in the frontend allow-list, so the contact badge never populates.
  - Breaks: sidebar badges for contact messages.

## Products list (stock fields)

- `GET /api/dashboard/products` — [exists]
  - UI reads from each product: `totalStock`, `variantCount`, `lowStockVariantCount` (plus `variantsCount` alias used by UI but backend sends `variantCount`).
  - Breaks: stock column stays hidden because `variantsCount` is never populated (`p.variantsCount` is undefined; backend field is `variantCount`).

## Product option values

Base: `/api/dashboard/product-options`

- `GET /api/dashboard/product-options` — [exists]
- `GET /api/dashboard/product-options/{optionId}` — [exists]
- `POST /api/dashboard/product-options` — [exists]
- `PUT /api/dashboard/product-options/{optionId}` — [exists]
- `DELETE /api/dashboard/product-options/{optionId}` — [exists]
- `POST /api/dashboard/product-options/{optionId}/values` (add value) — [exists]
- `PATCH /api/dashboard/product-options/{optionId}/values/{valueId}` (edit value) — [exists]
- `PUT /api/dashboard/product-options/{optionId}/values/order` (reorder) — [exists]
- `DELETE /api/dashboard/product-options/{optionId}/values/{valueId}` (delete value) — [exists]
  - On conflict returns 409 `OPTION_VALUE_IN_USE` with `data.variantCount` — [exists].
- `GET /api/dashboard/product-options/{optionId}/values/{valueId}/usage` (usage count) — [missing]
  - UI calls it (`getValueUsageCount`); breaks the pre-delete usage count display.
- `appliesTo` field on option — [exists] (backend returns `Set<ProductType>`).

## Roles and permissions

- `GET /api/dashboard/roles` — [exists]
- `GET /api/dashboard/roles/{name}` — [exists]
- `POST /api/dashboard/roles` — [exists]
- `PUT /api/dashboard/roles/{name}` — [exists]
- `DELETE /api/dashboard/roles/{name}` — [exists]
- `GET /api/dashboard/permissions` — [exists] (returns slug/resource/action list; frontend uses a static `ALL_PERMISSIONS` list instead of calling it).
- `PUT /api/dashboard/users/{id}/role` (change role, returns permission diff) — [exists]

## Users summary

- `GET /api/dashboard/users` returns `ApiResponse<PageResponse<UserResponse>>` with `summary` — [exists]
  - Summary fields read by UI: `total`, `admins`, `customers`, `blocked`, `unverified`.
  - Backend also returns `byRole` (list of `{role, count}`) — [exists], but frontend `ListSummary` does not declare `byRole`, so the by-role breakdown is ignored.
  - UI feature that breaks when missing: role cards counts on the Users list.

## Contact replies

- `GET /api/dashboard/contact-messages` — [exists]
- `GET /api/dashboard/contact-messages/{id}` — [exists]
- `GET /api/dashboard/contact-messages/stats/summary` — [exists]
- `GET /api/dashboard/contact-messages/unread` — [exists]
- `GET /api/dashboard/contact-messages/status/{status}` — [exists]
- `POST /api/dashboard/contact-messages/{id}/reply` (reply) — [exists]
  - Body: `{ replyContent }`. Frontend sends `{ replyContent }`.
- `POST /api/dashboard/contact-messages/{id}/resend-email` — [exists]
- `PATCH /api/dashboard/contact-messages/{id}/read` — [exists]
- `PATCH /api/dashboard/contact-messages/{id}/archive` — [exists]
- `DELETE /api/dashboard/contact-messages/{id}` — [exists]
