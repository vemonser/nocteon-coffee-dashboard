# Order detail v5 — the facts, the timeline, the numbers

**Date:** 2026-10-22
**Repos:** `nocteon-dashboard` (Angular 22) + `nocteon-backend` (Spring Boot 4.1 / Java 21)
**Branch:** `ui/order-detail-v5` (dashboard) · `feat/order-detail-v5` (backend)

---

## 1. Why this exists

The order detail page was audited and the audit found eight classes of defect:

1. **The header's actions disagree with the order's state.** A cancelled order still shows "Update status", "Refund", "Cancel". A refunded order shows "Cancel". The disabled tooltips exist but the buttons are visible and confusing.
2. **The customer card shows the STORE's numbers, not the CUSTOMER's.** "Admin Aurum" placed 4 orders; the card showed 17 and EGP 21,326.50 (the whole store).
3. **The items lie about pricing.** The line shows a strikethrough "regular price" computed as `unitPrice × 1.15` — a fiction the backend never stored. The SKU repeats its prefix (`SKU-1-1` → "SKU-1-1 SKU-1-1") because the column header and the cell both render it.
4. **The totals section cannot reconcile.** Tax is always 0 (the backend has no tax concept) but the code path exists, and the "Collected / Refunded / Balance" math is shown as a separate settlement while the order total and the items' subtotal disagree.
5. **The shipment dialog edits carrier/tracking but the order has no shipping zone/method display.**
6. **The timeline invents dates.** The backend returns empty history for every seeded order. The page currently logs only the order's `createdAt` and a "step dates are not recorded" banner — which is correct — but the UI still shows a progress tracker with fake step dates.
7. **Internal notes are mixed with customer-visible notes.** There is no distinction.
8. **Arabic RTL is broken in the header and the breadcrumb.** The breadcrumb direction, the order number inside it, the action icons — all read left-to-right in Arabic.

The rule the whole page runs on: **every number, every date, every status transition on this page comes from the API.** The browser never invents a value. If the API does not record it, the UI says "Not recorded" — not "—" and not a dash that looks like zero.

---

## 2. The backend contract (what must exist for the page to be honest)

### 2.1 Order status history — the blocking dependency

The timeline cannot exist without this endpoint. The backend currently returns `200` with `[]` for every seeded order.

**New endpoint:**
```
GET /api/dashboard/orders/{id}/history
```

**Response (one row per transition, oldest first):**
```json
[
  {
    "id": 1,
    "fromStatus": null,
    "toStatus": "PENDING",
    "note": null,
    "changedBy": "system",
    "notifyCustomer": false,
    "createdAt": "2026-10-20T05:49:48.204790Z"
  },
  {
    "id": 2,
    "fromStatus": "PENDING",
    "toStatus": "CONFIRMED",
    "note": "Payment received",
    "changedBy": "admin@aurum.local",
    "notifyCustomer": true,
    "createdAt": "2026-10-20T06:15:00Z"
  }
]
```

**Writers:**
- `PUT /api/dashboard/orders/{id}/status` writes a history row in the same transaction (it already receives `note` and `notifyCustomer`).
- A refund and a shipment should also write recorded events, or expose their own lists (the page already reads `/payment` and `/shipment`).

**Fields the page needs:**
- `changedBy` — currently not populated anywhere. The page shows it as an actor only when present.
- `changedByName` (or the admin's display name) — needed for a human timeline.

### 2.2 Shipment: ETA and delivery stamps

The model already has `shippedAt`, `deliveredAt`, `estimatedDeliveryAt` — none are persisted by seed or flow.

**Needed:**
- Persist the shipment on the status transition (or require it).
- Stamp `shippedAt` when status becomes `SHIPPED`, `deliveredAt` when `DELIVERED`.
- Add `estimatedDeliveryAt` to the shipment model and the form.
- A `DELIVERED` order with no shipment should be rejected by the backend, not only warned about in the UI.

### 2.3 Payment facts on PAID and REFUNDED orders

- `OrderPaymentDetails.paidAt` and `.transactionReference` are `null` for every seeded order, including PAID ones.
- `POST /api/dashboard/orders/{id}/refund` records a refund row, but seeded REFUNDED orders have none.
- Needed: persist `transactionReference` and `paidAt` when a payment is captured (gateway callback or COD collection). Record a refund row when status becomes `REFUNDED` (or expose `refundedAmount` on the order/payment). Return a non-null `netPaid`.

### 2.4 Customer aggregate (N+1 today)

No `GET /api/dashboard/customers/{id}/stats`. The page currently computes order count and paid lifetime value by walking `getEveryOrder({ userId })` — correct but reads every page of the customer's orders. The backend `userId` filter on the list endpoint is silently ignored (gap #1 in API_GAPS.md).

---

## 3. The header — breadcrumb + actions

### 3.1 Breadcrumb

```
Dashboard / Orders / ORD-2026-000001
```

The order number in the breadcrumb is a **copyable** element (icon on hover → click copies to clipboard). The breadcrumb respects RTL: in Arabic it reads right-to-left with the separators mirrored.

### 3.2 Actions (visible/enabled by state)

| Action | Shows when | Disabled when | Requires dialog |
|---|---|---|---|
| Copy order number | Always | Never | No |
| Print invoice | Always | Never | No |
| Update status | `canChangeStatus = true` (status has allowed transitions) | Status is `DELIVERED` or `CANCELLED` | Yes — dropdown with allowed next statuses only |
| Cancel | `canCancel = true` | Status is `CANCELLED` or `DELIVERED` (or no CANCELLED transition) | Yes — reason required |
| Refund | `canRefund = true` (paymentStatus = PAID) | PaymentStatus = REFUNDED or ≠ PAID | Yes — amount + reason |
| Resend email | Never (no backend endpoint) | Always | N/A — disabled with tooltip |

**The dropdown for "Update status" lists only `nextStatuses(current)` from the backend's `ALLOWED_TRANSITIONS`.** A `DELIVERED` order offers nothing. A `CANCELLED` order offers nothing. The dropdown never lets the admin pick an illegal transition.

### 3.3 Visual state of disabled actions

Disabled actions are **hidden from the dropdown**, not shown disabled. The "Update status" button is hidden entirely when `statusDisabledReason` is set. The kebab menu shows "Cancel" and "Refund" only when they are allowed. This prevents the "why is this here but grey?" confusion.

---

## 4. The customer card

### 4.1 What it shows

| Field | Source | Tooltip |
|---|---|---|
| Name | `order.customer.name` (with avatar fallback) | — |
| Email | `order.customer.email` (mailto link) | — |
| Phone | `order.address.phone` (tel: link) | — |
| WhatsApp | same phone (wa.me link) | — |
| Orders placed | **this customer's** order count | "Every order this customer placed, whatever its status" |
| Lifetime spend | **this customer's** paid orders sum | "Sum of totals of PAID orders only. Cancelled, failed, pending and refunded orders are excluded." |
| View customer | link → `/dashboard/users/{id}` | — |

**The numbers are the CUSTOMER'S, not the store's.** The page already computes them via `summarizeCustomerOrders` (client-side because the backend `userId` filter is ignored and there is no aggregate endpoint). The tooltip on "Lifetime spend" states the basis explicitly.

### 4.2 Link to the customer's orders list

A secondary link: "View all orders" → `/dashboard/orders?userId={id}` (works when the backend honours `userId`).

---

## 5. The items

### 5.1 Per line

| Element | Rule |
|---|---|
| Image | 48×48, links to product detail |
| Product name | links to `/dashboard/products/{productSlug}` |
| Variant label | The option values (weight, grind) from the catalog — **translated at render time**, so a runtime language switch updates it |
| SKU | Shown **once**, as-is from the backend (`SKU-1-1`). No prefix repetition. |
| Quantity × Unit price | `3 × EGP 650.00` |
| Line total | `EGP 1,950.00` |

### 5.2 No fake strikethrough

The catalog's `compareAtPrice` (if present) is shown as a **reference price** with the label "Regular price" and a tooltip: "The catalog's regular price for this variant, not a discount on this order." It is **never** rendered as a strikethrough on the line. A discount row in the totals appears **only** when `order.discountAmount > 0`.

### 5.3 No items state

An order with zero line items renders a warning icon + tooltip: "This order has no line items — the total is shipping minus discount." Never a silent "No items".

---

## 6. Totals and payment

### 6.1 The totals table (always in this order)

```
Subtotal           EGP 1,950.00
Discount           −EGP 100.00        (only when discountAmount > 0)
Shipping           EGP 50.00
Tax                EGP 0.00           (only when tax > 0 — backend has no tax)
──────────────────────────────
Total              EGP 1,900.00       ← orders.totalAmount (the number of record)
```

If `subtotal - discount + shipping ≠ total`, a warning banner appears: "The total the store recorded does not match the items on this order. The recorded total is the one shown."

### 6.2 Settlement — Collected / Refunded / Balance (below the totals)

This section **always appears**, but its values come from recorded data only.

| Row | Formula | When unknown |
|---|---|---|
| Collected | `payment.amount` if present, else `order.totalAmount` for PAID orders | PAID order with no payment detail |
| Refunded | Sum of refund lines | REFUNDED order with no refund line → "Not recorded" |
| Balance due | `Total - Collected - Refunded` (min 0) | If either Collected or Refunded is unknown, or order is CANCELLED → 0 |

**Rules:**
- A cancelled order owes nothing: `Balance due = 0` even if never paid.
- `null` is rendered as "Not recorded" (translated), never as `0.00`.
- The payment detail row shows `Method`, `Status`, `Transaction reference` (copyable), `Paid at` (with tooltip for the full datetime).
- **Warning banner** appears ONLY when the actual condition is met:
  - "This payment is marked paid, but the store did not record when it was paid or its transaction reference." (PAID with no `paidAt` and no `transactionReference` on ONLINE)
  - "This order is marked refunded, but no refund line was recorded, so the amount returned is unknown." (REFUNDED with zero refund lines)

---

## 7. The shipment

### 7.1 What is shown (read-only card)

| Field | Source |
|---|---|
| Carrier | `shipment.carrier` |
| Tracking number | `shipment.trackingNumber` (copyable) |
| Tracking URL | `shipment.trackingUrl` (opens in new tab) |
| Shipped at | `shipment.shippedAt` (formatted date+time, tooltip with full ISO) |
| Delivered at | `shipment.deliveredAt` |

### 7.2 Editable dialog

The "Record shipment" / "Edit shipment" dialog edits:
- Carrier (text)
- Tracking number (text)
- Tracking URL (text)
- **Estimated delivery at** (date picker — NEW field on the backend)

No ETA is shown on the read card until the backend stores it.

### 7.3 Warning states

- A `SHIPPED` or `DELIVERED` order with no shipment on record → orange warning banner: "This order is marked shipped or delivered, but no shipment is recorded."

---

## 8. The timeline and history

### 8.1 The progress tracker (top of the timeline section)

Shows the fulfilment chain as steps:
```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
```

Each step shows:
- The status label (translated)
- **Recorded date+time** from history (`toStatus = this step`)
- Actor (who moved it)
- "Current step" / "Completed" badge

**If history is missing for a step** the step shows "Not recorded" — no invented date. The progress tracker is driven by `stepRecords` (the history mapped by `toStatus`).

### 8.2 The activity log (below the progress tracker)

A single merged log, newest first, built by `buildOrderEvents` from:

| Source | Event kind | What it shows |
|---|---|---|
| `order.createdAt` | `placed` | "Order placed" + timestamp |
| `history[]` | `status` | "Pending → Confirmed" + actor + note + notify flag |
| `payment.paidAt` | `payment` | "Payment received" + amount |
| `shipment.shippedAt` | `shipment` | "Shipment handed to the carrier" |
| `shipment.deliveredAt` | `shipment` | "Shipment delivered" |
| `refunds[]` | `refund` | "Refund issued" + amount + reason + actor |
| `notes[]` | `note` | "Note added" + body + author |

**No `email` events exist** — the backend has no mail log endpoint. The moment one exists it belongs here.

**Until the history endpoint returns data**, the timeline shows only:
- The order's `createdAt` as "Order placed"
- The banner: "Step dates are not recorded — the store has no status history for this order yet."

The page **never invents** a journey.

### 8.3 Internal notes (separate section)

Admin-only notes, newest first. Each shows:
- Body
- Author (admin email)
- Timestamp

The "Add note" textarea is below the list. Notes are internal — never shown to the customer.

---

## 9. States

| State | What the reader sees |
|---|---|
| Loading | Skeleton for the two-column layout (left: items + totals + timeline; right: customer + address + payment + shipment). The header shows a skeleton for the order number. |
| Not found (404) | Centered card: icon, "Order not found", "This order does not exist, or you no longer have access to it.", "Back to orders" button. |
| Error (5xx, network) | Centered card: title, the error message, "Retry" + "Back to orders". |
| RTL | The breadcrumb, the order number, the action icons, the numbers, the timeline icons — all render correctly in Arabic. No layout shift, no LTR bleeding. |

---

## 10. The data fixes (backend migrations)

| Migration | What it does |
|---|---|
| `V115__order_status_history.sql` | Populates `order_status_history` for the 17 seeded orders: a creation row (`fromStatus = null, toStatus = 'PENDING'`) plus transitions that match the current status (e.g. DELIVERED orders get PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED). `changedBy = 'seed'`. |
| `V116__shipment_delivery_stamps.sql` | Stamps `shippedAt` on SHIPPED orders, `deliveredAt` on DELIVERED orders. Adds `estimatedDeliveryAt` column to `shipments`. |
| `V117__payment_facts_on_paid_orders.sql` | Sets `paidAt` and `transactionReference` on the `payments` table for PAID orders. For COD orders, `paidAt = updated_at`, `transactionReference = 'COD'`. |
| `V118__refund_rows_for_refunded_orders.sql` | Inserts refund rows for orders with `payment_status = 'REFUNDED'` that have none, using the order's `total_amount` (full refund). |

---

## 11. What is NOT in this change

* The customer aggregate endpoint — the page keeps the client-side computation (correct for 17 orders, documented in API_GAPS.md).
* The `userId` filter fix on the list endpoint — documented as a backend gap.
* The `refundedAmount` on the order row — the settlement subtracts what it can see; the detail page still reports "Not recorded" when no refund row exists.
* Tags — API_GAPS.md gap #1 of order details v3.

---

## 12. Validation

| What | How | Gate |
|---|---|---|
| Backend compiles, tests pass | `./mvnw verify` | must exit 0 |
| History endpoint returns rows | live `curl /api/dashboard/orders/1/history` | JSON array with ≥1 entry per seeded order |
| Payment `paidAt`/`transactionReference` present | live `curl /api/dashboard/orders/1/payment` | non-null for PAID orders |
| Shipment `shippedAt`/`deliveredAt` present | live `curl /api/dashboard/orders/8/shipment` (SHIPPED) | non-null |
| Refund rows exist for REFUNDED orders | live `curl /api/dashboard/orders/9/refunds` | array with ≥1 entry |
| KPI math (if any) | Vitest unit tests | must exit 0 |
| Page behaves (all states) | rewritten `e2e/orders.spec.ts` + new `e2e/order-detail.spec.ts` | must exit 0 |
| No raw key on screen | existing e2e "a raw translation key never reaches the screen" | must pass |
| No overflow at 1440, both themes | browser evidence (measured `scrollWidth` vs `clientWidth`) | measured |
| 4 screenshots: light/dark × EN/AR at 1440×900 | Playwright captures | captured |
| Cancelled / Shipped / Refunded states captured | same suite | captured |
| Every number traceable to API | manual audit of the rendered page | documented |
| Evidence chain intact | software-factory Evidence Gate | must exit 0 |

---

## 13. The file map

**Backend** (`nocteon-backend`)

```
src/main/resources/db/migration/V115__order_status_history.sql          (new)
src/main/resources/db/migration/V116__shipment_delivery_stamps.sql      (new)
src/main/resources/db/migration/V117__payment_facts_on_paid_orders.sql  (new)
src/main/resources/db/migration/V118__refund_rows_for_refunded_orders.sql (new)
src/main/java/…/order/entity/OrderStatusHistory.java                    (verify)
src/main/java/…/order/dto/response/OrderStatusHistoryResponse.java      (verify)
src/main/java/…/order/service/OrderStatusService.java                   (history writer)
src/main/java/…/order/service/OrderShipmentService.java                 (ETA, stamps)
src/main/java/…/order/service/PaymentService.java                       (paidAt, ref)
src/main/java/…/payment/entity/Payment.java                             (verify fields)
src/test/java/…/order/service/OrderStatusServiceTest.java               (history writer)
src/test/java/…/order/service/OrderShipmentServiceTest.java             (stamps)
src/test/java/…/order/service/PaymentServiceTest.java                   (facts)
```

**Frontend** (`nocteon-dashboard`)

```
src/app/features/orders/order-detail/order-detail.component.ts          (header actions, state logic)
src/app/features/orders/order-detail/order-detail.component.html        (layout, RTL, RTL-safe breadcrumb)
src/app/features/orders/order-detail/order-detail.component.css         (print styles, RTL tweaks)
src/app/features/orders/components/order-progress/order-progress.component.ts  (progress tracker)
src/app/features/orders/components/order-status-dialog/order-status-dialog.component.ts  (dropdown only)
src/app/features/orders/components/order-cancel-dialog/order-cancel-dialog.component.ts  (reason required)
src/app/features/orders/components/order-refund-dialog/order-refund-dialog.component.ts  (amount + reason)
src/app/features/orders/components/order-shipment-dialog/order-shipment-dialog.component.ts  (ETA field)
src/app/features/orders/utils/order-settlement.ts                       (settlement math)
src/app/features/orders/utils/customer-summary.ts                       (customer's own numbers)
src/app/features/orders/adapters/order-activity.adapter.ts              (buildOrderEvents)
src/app/features/orders/models/order-status.model.ts                    (canChangeStatus, canCancel, canRefund)
public/assets/i18n/en.json · ar.json                                    (new keys: breadcrumb copy, tooltips, warnings)
e2e/order-detail.spec.ts                                                (new)
e2e/orders.spec.ts                                                      (extended)
API_GAPS.md · DECISIONS.md · SEED_PROPOSAL.md · e2e/README.md           (updated)
```

---

## 14. Migration sequence (safe order)

1. **Backend first** — the four Flyway migrations (V115–V118) are additive and idempotent. They touch only the 17 seeded orders and the new columns (`estimatedDeliveryAt`).
2. **Frontend** — the page reads the new fields. If the backend is not yet migrated, the page shows "Not recorded" (which is true) instead of inventing values.
3. **E2E** — the suite runs against the migrated database and asserts the new behaviour.