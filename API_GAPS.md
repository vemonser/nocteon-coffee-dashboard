# API_GAPS.md — proposed contracts the frontend is waiting on

Status: PROPOSAL ONLY. Nothing here has been implemented on the backend.
The frontend builds against typed adapters behind flags (see DECISIONS.md)
so the UI can be demonstrated, but real data flows only once these land.

## Orders

### 1. KPI aggregates on the stats endpoint
`GET /api/dashboard/orders/stats` currently returns counts only. The 4 compact
KPI cards (Revenue net of refunds, Open orders, Avg order value,
Refund/cancel rate) need:
```json
"data": {
  "total": 17,
  "revenueNetOfRefunds": 1176.25,
  "refundedAmount": 0.00,
  "avgOrderValue": 69.19,
  "cancelRate": 0.294,
  "byStatus": [...],
  "byPaymentStatus": [...],
  "byPaymentMethod": [...]
}
```
Frontend adapter: computes revenue/cancelRate from a full read of the filtered
set behind flag `COMPUTE_KPI_FROM_ALL_ROWS` (default true) until this lands.

### 2. Order status history / activity events
No endpoint exists for order events (status changes, payment, shipment,
email, notes, refunds). Proposed:
`GET /api/dashboard/orders/{id}/activity` returning
```json
[
  { "type": "STATUS_CHANGE", "from": "CONFIRMED", "to": "PROCESSING", "actor": "admin@...", "at": "...", "note": "..." },
  { "type": "PAYMENT", "status": "PAID", "amount": 120.50, "reference": "...", "at": "..." },
  { "type": "SHIPMENT", "carrier": "...", "trackingNumber": "...", "at": "..." },
  { "type": "EMAIL", "kind": "STATUS_UPDATE", "to": "...", "at": "..." },
  { "type": "NOTE", "body": "...", "author": "...", "at": "..." },
  { "type": "REFUND", "amount": 10.00, "reason": "...", "at": "..." }
]
```
Frontend builds against `getActivity()` adapter (history + notes + payment)
until this lands; shows "No recorded events yet" only when truly empty.

### 3. Refunded amount on an order
`OrderResponse.totalAmount` must stay the original total. Add `refundedAmount`
and `netPaid` (already in OrderPaymentDetails) to the order row so the list
can show "Refunded EGP x" without a second call.

### 4. COD + Cancelled payment status
COD cannot "fail". Propose payment status `NOT_COLLECTED` for cancelled COD
orders instead of `FAILED`.

### 5. Paid-at + transaction reference
Paid orders must populate `paidAt` and `transactionReference`. Frontend shows a
data warning when missing.

## Carts

### 6. Cart status, last activity, converted order
`CartResponse` needs: `status` (ACTIVE/ABANDONED/CONVERTED), `lastActivityAt`,
`convertedOrderId`. Abandoned threshold default 24h, configurable (see
DECISIONS.md). Frontend derives status client-side until backend sends it.

### 7. Send reminder endpoint
`POST /api/dashboard/carts/{id}/remind` — sends an abandonment reminder
e-mail. Returns 202. Frontend calls it behind a flag; shows toast either way.

### 8. Stock/low-stock on cart lines
`CartItemResponse.stockQuantity` exists. Add `lowStockThreshold` (default 3) so
the UI can show a warning chip consistently.

## Shared

### 9. SKU format
Orders use `SKU-1-1`, carts use `SKU-001`. Propose a single format
`SKU-<product>-<variant>` zero-padded to 3 digits. Document in SEED_PROPOSAL.

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
### 10. Currency/scale
Cart prices (12.50/14/11) vs order prices (650/525) suggest different scales.
Confirm whether carts are in a different currency or the seed is wrong;
propose a single currency (EGP) and a single scale across both entities.
