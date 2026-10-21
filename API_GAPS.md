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

## Order details v3 (ui/order-details-v3)

Verified against the running backend on 2026-10-21 with the seeded 17 orders.
The page never invents a value for any of the gaps below; it shows "Not
recorded", an inline warning, or a disabled action with the reason.

### 1. Order status history is an empty contract (blocker for the timeline)

- `GET /api/dashboard/orders/{id}/history` exists and returns `200`, but every
  seeded order returns `[]`. The page therefore logs only the order's
  `createdAt` (a real timestamp) and states that step dates are not recorded.
- What is needed: the endpoint must return one row per transition:
  `id, orderId, fromStatus (null on creation), toStatus, note, changedBy,
  notifyCustomer, createdAt`, oldest first, including the creation row.
- Writers: `PUT /api/dashboard/orders/{id}/status` must write a history row in
  the same transaction as the status change (it receives `note` and
  `notifyCustomer` today). A refund and a shipment should also be written as
  recorded events (or exposed through their own lists, which the page already
  reads).
- `changedBy` is currently not populated anywhere; the page shows it as an
  actor only when present.
- Missing actor display name: `changedBy` is an e-mail at best. A `changedByName`
  (or the admin's display name) is needed for a human timeline.

### 2. Shipment: fields exist on the model, none are persisted by seed/flow

- `GET /api/dashboard/orders/{id}/shipment` and
  `PUT /api/dashboard/orders/{id}/shipment` exist and accept `carrier`,
  `trackingNumber`, `trackingUrl`. `OrderResponse.shipment` is `null` for every
  seeded order, including SHIPPED and DELIVERED ones.
- There is no `estimatedDeliveryAt` (ETA) field; the shipment form does not ask
  for one and the card does not show one.
- `shippedAt` / `deliveredAt` are not stamped when the status changes to
  SHIPPED / DELIVERED. They are only whatever the shipment row already has.
- Needed: persist the shipment on the status transition (or require it), stamp
  `shippedAt`/`deliveredAt`, and add `estimatedDeliveryAt`. A DELIVERED order
  with no shipment should be rejected by the backend, not only warned about in
  the UI.

### 3. Payment facts are missing on PAID and REFUNDED orders

- `OrderPaymentDetails.paidAt` and `.transactionReference` are `null` for every
  seeded order, including PAID ones. The page shows an inline warning on a PAID
  order whose payment facts are missing.
- `POST /api/dashboard/orders/{id}/refund` records a refund row, but the seeded
  REFUNDED orders have no refund rows. For order 9 the payment endpoint returns
  `amount: 0, netPaid: null, refunds: []` — the refunded amount cannot be
  derived, so the page shows "Not recorded" for Refunded rather than `0`.
- Needed: persist `transactionReference` and `paidAt` when a payment is
  captured (gateway callback or COD collection), record a refund row when the
  status becomes REFUNDED (or expose `refundedAmount` on the order/payment),
  and return a non-null `netPaid`.
- The gateway refund itself is not wired: the service records the refund and
  marks it `manual`. The UI copies the dialog's "goes back through the gateway"
  wording only because that is the intended contract; the actual gateway call
  is a backend gap.

### 4. Customer aggregate (N+1 today)

- No `GET /api/dashboard/customers/{id}/stats`. The page computes order count
  and paid lifetime value by walking `getEveryOrder({ userId })`, which is
  correct but reads every page of the customer's orders.
- Needed: `{ orderCount, paidOrderCount, lifetimePaid, lastOrderAt }`, with a
  documented basis (which payment statuses count).

### 5. Per-line money and order-level money that do not exist

- `OrderItemResponse` has no per-line discount (`discountAmount`) and no
  `compareAtPrice`. The page uses the catalog's `compareAtPrice` only as a
  struck-through "regular price", explicitly not as an order discount.
- `OrderResponse` has no `couponCode` and no `taxAmount`. The page shows a Tax
  row only when a tax value ever appears, and a Discount row from the order's
  `discountAmount` only.
- Needed if the business wants them: `discountAmount` per line, `couponCode`,
  `taxAmount` (and a tax basis), all persisted at order creation.

### 6. Resend order e-mail

- No endpoint to send an order e-mail on demand. The action is disabled with
  the reason "the store sends order e-mails automatically, but it cannot send
  one on demand." A `POST /api/dashboard/orders/{id}/resend-email` (and an
  event row when it is sent) would make the action real.
