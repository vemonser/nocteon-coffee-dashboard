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