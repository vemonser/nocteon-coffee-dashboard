# API_GAPS.md — Nocteon Dashboard

Appended by the global search round (ui/global-search-v2).

## Aggregated search endpoint (BLOCKED on backend)

Frontend expects (behind flag `GLOBAL_SEARCH_USE_MOCK = true` in
`src/app/features/layout/navigation-bar/global-search/service/global-search.service.ts`):

`GET /api/admin/search?q=&limitPerType=5`

Response: `ApiResponse<{ groups: SearchGroup[], totalCount: number }>` where
`SearchGroup = { type, total, items: SearchItem[] }` and
`SearchItem = { id, type, title, subtitle, status (raw enum), thumbnail, meta, route, ...type-specific fields }`.

Entities and match fields:
- orders: full number (ORD-2026-000002), partial number ("2026-000002", "#2"), customer name/email/phone, transaction reference, tracking number
- products: name (EN + AR), SKU
- categories: name (EN + AR)
- customers: name, email, phone
- reviews: comment text, reviewer name
- contact messages: subject, sender name/email, body
- carts: customer name/email
- shipping zones: name

Must respect admin permissions (staff accounts, if searchable, are a separate group).

Arabic normalization on backend: strip tashkeel; unify alef variants (أ إ آ -> ا), ي/ى, ة/ه. Ranking: exact match, then prefix, then substring.

## Order identifier
Orders pages must use the full order number (`ORD-2026-000002`) everywhere (list, details, search, breadcrumbs) instead of "Order #2". Backend already returns orderNumber; frontend should prefer it over numeric id.
EOF
## Contact messages & reviews round (ui/contact-reviews-v2)

### Contact messages
- **Mark as unread**: no `PATCH /api/dashboard/contact-messages/{id}/unread` endpoint. Only mark-as-read exists. Frontend disables the action and logs it. (gap)
- **Bulk mark-read / bulk delete**: no bulk endpoints. Frontend falls back to per-id calls. (gap)
- **Resend email**: frontend calls `/resend-email` which does not exist in backend (404). Backend has no resend capability. (gap)
- **Reply metadata**: backend `ContactResponse` has no `repliedAt`/`repliedBy`/`emailStatus`. Frontend `emailStatus` is always undefined; email-state block hidden. Add these fields or remove frontend reliance. (gap)
- **Pagination/filtering**: contact endpoint takes no status filter, search, or date params; frontend loads whole set (max 100) and filters client-side. (gap, by design)
- **Reply persistence**: `replyContent` is returned after reply; `replied` flag set. Confirmed working.

### Reviews
- **Rejected/hidden state**: backend has only `isApproved` boolean. No rejected state, no reject endpoint. Frontend does not add a Rejected tab. (gap)
- **Verified purchase verification**: backend `ReviewResponse` has no `orderId`/`orderNumber`. Frontend `VerifiedBadge` links to order only when present (never). Verified = reviewer has a Delivered order containing the product; seed audit needed. (gap)
- **Reviewer identity**: backend returns `username` (lowercase) only, no full name. Frontend displays username. Source of truth decision pending (Orders show full name). (gap)
- **Verified count in stats**: `ReviewStatsResponse` has no verified count. Frontend computes verified share from loaded page only (approximate). (gap)
- **Admin response to review**: no backend support. (gap)
- **Bulk approval**: backend `setApproval` accepts `ids[]` (exists). OK.
- **Product name sort**: backend sorts by entity field; `product.name` nested path may or may not be supported. (gap, verify)

## Orders list v3 (ui/orders-list-v3)

- `refunded_amount` / refund amount not in `OrderResponse`; list shows secondary "Refunded" line only when present (optional field added). Backend gap: expose refunded amount on order/payment.
- Resend email: no backend endpoint; action reports unavailable.
- Bulk status change: no bulk endpoint; frontend applies per selected order.

## Reviews v3 (ui/reviews-v3)

- Approved-only average rating: `ReviewStatsResponse.averageRating` is computed over all reviews (4.0). An approved-only figure (4.31) needs a dedicated aggregate or a new param; frontend keeps the all-reviews value and labels it accordingly.
- Exact rating filter: backend exposes `minRating` only; the distribution bars filter by `minRating` (N and up) because there is no `maxRating`/exact param.
- Reviewer full name: backend returns `username` (lowercase) only; no full name. Frontend title-cases the username.
- Verified purchase: backend now returns `orderId`/`orderNumber` (present in model); seed audit of which reviews are verified is reported in SEED_PROPOSAL.md.

## Review details dialog v3 (ui/review-dialog-v3)

Every line below was checked against the RUNNING backend (`main`, live call on
2026-10-21, `GET /api/dashboard/reviews`), not against the DTO on disk.

- **The verified-purchase order is not in the response — BLOCKED on backend.**
  The live `ReviewResponse` carries `id, username, avatarUrl, rating, comment,
  verified, approved, productName, productSlug, primaryImageUrl, createdAt` and
  NO `orderId` / `orderNumber`. The "View order ORD-…" link in the dialog is
  therefore rendered only when the fields arrive; with the API as it is today
  the link does not appear, and nothing is invented to fill it. The DTO with
  `orderId` / `orderNumber` exists on the backend branch
  `feature/reviews-messages-backend` but is NOT deployed. The dashboard model
  keeps both fields optional (`number | null`), so the day the backend ships
  them the link appears with no frontend change. (gap)
- **No reject action, no rejected state — BLOCKED on backend.**
  `ReviewController` exposes `PATCH /api/dashboard/reviews/{id}/approval?approved=`
  and `DELETE /api/dashboard/reviews/{id}`; there is no reject endpoint and
  `approved` is a boolean, so a rejected review has nowhere to live. The
  Pending dialog therefore offers Approve (primary), Close and Delete only.
  A "Reject" button is NOT rendered disabled either: a dead button reads as a
  broken product. (gap)
- **No admin reply — BLOCKED on backend.**
  There is no endpoint and no column for a public answer from the dashboard.
  The reply feature is skipped in this round and logged in DECISIONS.md. (gap)
- **The reviewer still has no full name.** `username` is the only identity the
  API returns; the dialog title-cases it, as the list does. (gap, unchanged)
- **The product page of the dashboard has no read-only route.** Not an API
  gap: `/dashboard/products/:slug` does not exist as a route, so the product
  name in the dialog links to `/dashboard/products/:slug/edit`, the only
  product page the dashboard has. A read-only product page would be a routing
  task, not an API one. (gap, frontend)
