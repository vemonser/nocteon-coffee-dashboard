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
