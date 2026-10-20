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

### 10. Currency/scale
Cart prices (12.50/14/11) vs order prices (650/525) suggest different scales.
Confirm whether carts are in a different currency or the seed is wrong;
propose a single currency (EGP) and a single scale across both entities.
