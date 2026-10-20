# ORDERS_CONTRACT.md — what the orders pages need from the backend

**Status: PROPOSAL — waiting for approval. Nothing here has been built on the
backend.** Phase 5 of the ticket says to write this document, mark the parts
that are backend work, and stop. This is that document.

The backend lives in a **separate repository** (`../nocteon-backend`, Spring
Boot, branch `fix/audit-findings`). Everything in §2, §3 and §4 is backend
work; §1 and §5 are what the frontend can do with what exists today.

---

## 1. What exists today, and what the UI does with it

The dashboard already works against the API that exists. The order pages
use it as it is, and say so where the API is silent.

| Capability | Endpoint / field | Status today | What the UI does |
|---|---|---|---|
| The order list | `GET /api/dashboard/orders?page&size&sort&direction&status&userId` | works | the list, with the filters the API does not support applied in the browser (see §1.1) |
| One order | `GET /api/dashboard/orders/{id}` | works | the detail page |
| The status change | `PUT /api/dashboard/orders/{id}/status` body `{ status }` | works, but the transition check is **too loose** (see §2.1) | the "Update status" dialog, which enforces the STRICT matrix itself |
| The order number | `orders.order_number` → `ORD-<year>-<6 digits>` | works | shown exactly as the backend gives it; never re-formatted |
| The items | `orders.items[]` with `unitPrice`, `totalPrice`, `sku`, `productName`, `primaryImageUrl` | works | the items card |
| The totals | `orders.total_amount`, `shipping_cost`, `discount_amount` | works, but the **seeded values disagree with the items** (see §1.2) | the totals card, which shows the stored total AND the items' subtotal, and says when they disagree |
| The customer | `orders.customer` → `id`, `name`, `email` | works | the customer card (the phone comes from the order's address) |
| The address | `orders.address` | works | the shipping-address card, with a copy button |
| The payment | `orders.payment_status`, `orders.payment_method` | works | the payment card |
| The progress tracker | derived from the current status | works | the tracker in the timeline card |
| The order status labels | `orders.statuses.*` + `common.statuses.*` | works | one word per concept, pinned by a unit test |

### 1.1 The filters the API does not accept

`OrderFilterRequest` (the backend) extends `BaseFilterRequest` and adds
`status` and `userId`. It has **no** `search`, `paymentStatus`,
`paymentMethod`, `dateFrom` or `dateTo`.

The ticket asks for all of them. Until the API grows them, the list fetches
**the whole set** (the API caps a page at 100, so it pages through) and
applies the missing filters in the browser. The counts are therefore
EXACT — not "the rows on this page" — which is what the ticket is really
after. The cost is a full read of the orders table per request; the list
caps it at 1,000 orders and says so when the cap is reached.

**The honest alternative** (and the one the API should grow) is in §3.1.

### 1.2 The totals that disagree

**17 of the 17 seeded orders** have a stored `total_amount` that does not
match their own items. The runtime formula in `OrderService.createOrder` is
correct:

```
total = (Σ variant.price × quantity − discount_amount) + shipping_cost
```

The seed migration `V107__seed_orders_reviews_contacts.sql` writes
`orders.total_amount` **by hand**, independently of the `order_items` rows
it inserts in the same file. `ORD-2026-000001` stores 120.50 while its items
are 1,825.00 + 50.00 shipping. The full list is in
`evidence/orders/measurements.json` → `totals.affectedOrders`.

The UI does **not** hide this: the totals card shows the stored total (the
backend is the source of truth), the subtotal the items add up to, and a
warning when the two disagree. A data repair (a migration that recomputes
the column) is a decision about the store's books, not a UI decision — see
`ORDERS_SEED_PROPOSAL.md` §5.

## 2. The defects in the API that the UI works around

These are **not** new features; they are things the API does that are
inconsistent with the intended contract. Each one is a small, isolated
change.

### 2.1 The status endpoint accepts transitions the state machine forbids

**Today:** `PUT /api/dashboard/orders/{id}/status` → `OrderService.updateStatus`
refuses a change only when the CURRENT status is `DELIVERED` or `CANCELLED`.
Every other pair is accepted — `PENDING → DELIVERED` is allowed.

**Intended:** `OrderStatusService.ALLOWED_TRANSITIONS` already exists and is
correct:

| From | To |
|---|---|
| `PENDING` | `CONFIRMED`, `CANCELLED` |
| `CONFIRMED` | `PROCESSING`, `CANCELLED` |
| `PROCESSING` | `SHIPPED`, `CANCELLED` |
| `SHIPPED` | `DELIVERED` |
| `DELIVERED` | — (terminal) |
| `CANCELLED` | — (terminal) |

**But `OrderStatusService` is dead code** — no controller calls it; only its
own unit test does. That is why the loose rule is the live rule.

**The fix:** make `OrderService.updateStatus` delegate to
`OrderStatusService` (or move the map into the service the controller
calls), and answer a rejected transition with `409 Conflict` and the
`InvalidOrderStatusTransitionException` that already exists.

**Until then, the UI offers only the strict transitions** — a superset-safe
choice: the UI can never ask for something the intended contract forbids.

**Open question for the decision:** the strict map does not allow
`SHIPPED → CANCELLED`. A store usually wants to cancel an order that has
shipped but not yet been delivered (the customer refused it). The strict map
says no. **Should `SHIPPED → CANCELLED` be added?** The UI follows the
strict map until this is decided.

### 2.2 `OrderStatusService` is not wired to the endpoint

See §2.1. One line of wiring (plus the exception mapping) fixes both.

### 2.3 The seed's order numbers can collide with the runtime sequence

The seed writes `ORD-2026-000001` … `ORD-2026-000017` by hand; the runtime
generates them from the `order_number_seq` sequence. The next order the
application creates would be `ORD-2026-000001` — a duplicate. The seed must
use `nextval('order_number_seq')`, and the 17 existing numbers must be
renumbered (a data repair, like §1.2).

### 2.4 The order's phone is only on the address

`OrderResponse.customer` has no phone. The UI shows the address's phone on
the customer card, because that is the phone the order goes to. A store
would rather have the customer's own phone; see §3.5.

## 3. The endpoints Phase 5 asks for

Each is written as the contract the frontend will code against. Nothing
here exists today.

### 3.1 `GET /api/dashboard/orders/stats` — the counts behind the cards

The ticket asks for the cards to come from a stats endpoint rather than
from the rows on the page. Today there is no such endpoint, so the list
computes the counts from the whole set (exact, but a full read).

**Contract**

```
GET /api/dashboard/orders/stats
    ?status=&paymentStatus=&paymentMethod=&dateFrom=&dateTo=&search=

200 {
  "success": true,
  "message": "Order statistics retrieved",
  "data": {
    "total": 17,
    "byStatus":       [ { "status": "PENDING", "count": 0 }, … ],
    "byPaymentStatus":[ { "paymentStatus": "PAID", "count": 10 }, … ],
    "byPaymentMethod":[ { "paymentMethod": "ONLINE", "count": 14 }, … ]
  }
}
```

The filters are the SAME parameters as the list, and the counts are the
counts **of the filtered set** — the same set the table shows. The list
would then ask for the list and the stats in one round trip.

**Permission:** `order:read` (the same as the list).

### 3.2 `PATCH /api/dashboard/orders/{id}/status` — the status change

**Today:** `PUT /api/dashboard/orders/{id}/status` with `{ status }`.

**Proposed:** keep `PUT` (it exists; changing the verb is churn) and extend
the body:

```
PUT /api/dashboard/orders/{id}/status
{
  "status": "SHIPPED",
  "note": "Packed and handed to the carrier",     // optional, ≤ 500 chars
  "notifyCustomer": true,                          // optional
  "reason": "Customer refused the delivery"        // REQUIRED when status = CANCELLED
}

200 { "success": true, "data": { …the order… } }
409 { "success": false, "message": "Cannot change order status from DELIVERED to PENDING" }
400 { "success": false, "message": "A reason is required to cancel an order." }
```

- The transition is validated against the strict matrix (§2.1).
- `note`, `notifyCustomer` and `reason` are written to the history row
  (§3.3) **in the same transaction** as the status change.
- `reason` is required when `status = CANCELLED`.

**The frontend already sends the note and the reason** — the service only
sends them when the backend declares support for them
(`OrderService.updateStatus(id, update, { supportsNote: true })`), so the
UI is not broken by a backend that ignores them.

### 3.3 `order_status_history` — the timeline

**Table**

```sql
CREATE TABLE order_status_history (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status     VARCHAR(32),
    to_status       VARCHAR(32) NOT NULL,
    note            TEXT,
    changed_by      VARCHAR(255),
    notify_customer BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_osh_order ON order_status_history (order_id, created_at);
```

`from_status` is null for the first row (the order was placed).

**Written in the same transaction as every status change** — a status change
without its history row is a bug, not a partial success. The creation of
the order writes the first row (`from_status = null`, `to_status = PENDING`
or `CONFIRMED`).

**Endpoint**

```
GET /api/dashboard/orders/{id}/history

200 {
  "success": true,
  "data": [
    { "id": 1, "orderId": 15, "fromStatus": null, "toStatus": "PENDING",
      "note": null, "changedBy": "sara@example.com", "notifyCustomer": false,
      "createdAt": "2026-10-14T09:12:00Z" },
    { "id": 2, "orderId": 15, "fromStatus": "PENDING", "toStatus": "CONFIRMED",
      "note": "Paid by card", "changedBy": "sara@example.com", "notifyCustomer": true,
      "createdAt": "2026-10-14T09:13:00Z" }
  ]
}
```

**Permission:** `order:read`.

### 3.4 `order_notes` — the internal notes

**Table**

```sql
CREATE TABLE order_notes (
    id         BIGSERIAL PRIMARY KEY,
    order_id   BIGINT      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    author     VARCHAR(255) NOT NULL,
    body       TEXT        NOT NULL,
    is_internal BOOLEAN    NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Endpoint**

```
POST /api/dashboard/orders/{id}/notes
{ "body": "Customer asked for a gift note.", "isInternal": true }

201 { "success": true, "data": { "id": 1, "orderId": 15, "author": "admin@aurum.local",
      "body": "…", "isInternal": true, "createdAt": "…" } }

GET /api/dashboard/orders/{id}/notes
200 { "success": true, "data": [ … ] }
```

`is_internal` is always true in the dashboard: a note that is not internal is
a customer-facing message, which is a different feature.

**Permission:** `order:update` to write, `order:read` to read.

### 3.5 The shipment

```
PUT /api/dashboard/orders/{id}/shipment
{
  "carrier": "Bosta",
  "trackingNumber": "BST-123456789",
  "trackingUrl": "https://bosta.com/track/BST-123456789",
  "shippedAt": "2026-10-18T11:30:00Z",
  "deliveredAt": null
}
```

**Backend work:** a `shipment` table (or the columns on `orders`), the
endpoint, and the `shipped_at` / `delivered_at` set by the status change
when it moves to `SHIPPED` / `DELIVERED`.

There is **no carrier API** in the backend today, so the tracking URL is
what the admin pastes. Nothing in the UI pretends to poll a carrier.

**Permission:** `order:update`.

### 3.6 The payment details

`OrderResponse` exposes no transaction reference, no `paid_at` and no
refunds. The payment card needs:

```
GET /api/dashboard/orders/{id}/payment

200 {
  "success": true,
  "data": {
    "method": "ONLINE",
    "status": "PAID",
    "transactionReference": "PAY-9f2c…",
    "paidAt": "2026-10-14T09:13:00Z",
    "refunds": [
      { "id": 1, "amount": 120.50, "reason": "The customer returned the bag",
        "createdBy": "admin@aurum.local", "createdAt": "2026-10-22T08:00:00Z" }
    ]
  }
}
```

**Backend work:** a `refunds` table, the endpoint, and the recording of the
transaction reference and `paid_at` when the payment webhook succeeds.

**The refund endpoint is a SEPARATE decision — see §4.**

### 3.7 The tags

Nothing in the backend has tags for orders. A `order_tags` table and a
`PUT /api/dashboard/orders/{id}/tags` endpoint would be new work. The
ticket lists tags in the sidebar, so the card is there with an honest line
until the endpoint exists.

## 4. The features that must NOT be faked

The ticket's rule: *"If a feature needs something that does not exist (email
sending, payment gateway refund, carrier API), do not fake it: build the UI
only if the backend capability is real, otherwise hide or disable it with an
honest label and list it under 'contract gaps'."*

| Feature | The backend reality | What the UI does now | What it needs |
|---|---|---|---|
| **Email sending** | **REAL.** `OrderEmailEventListener` sends the order confirmation when the order is placed, `OrderShippedEmailListener` sends the shipping notice when it ships, and `OrderStatusChangedEmailListener` now sends a status notice when the admin ticks "notify the customer" — enqueued after the transaction commits. There is still **no endpoint to re-send an e-mail on demand**. | the "Resend email" button is **disabled** with the reason on it; the status dialog's "notify the customer" switch is **live** | `POST /api/dashboard/orders/{id}/resend-email` (re-send the confirmation) |
| **Payment gateway refund** | **BUILT.** The money goes back through Paymob (`POST /api/acceptance/refunds`, the parent transaction id and the amount in cents), and the refund is recorded ONLY when the gateway accepts it. The live call cannot be exercised in this environment: it has no Paymob credentials, so the seeded orders — which have no payment row at all — are refused with "only a paid order can be refunded" | the refund dialog asks for the amount and a reason, and the gateway's refusal is shown as it is | nothing — it is built (§3.6) |
| **Carrier API** | **NOT REAL.** No carrier, no tracking number, no tracking URL, no delivery timestamps anywhere in the backend. | the shipment card says the store does not record shipments yet | the shipment table and endpoint (§3.5); a carrier integration is a separate project |
| **Tax** | **NOT REAL.** There is no tax column, field or calculation anywhere in the backend. | the totals card has no tax line | a tax model (a rate, a tax-inclusive/exclusive rule) — out of scope for orders |
| **Order history** | **NOT REAL.** No `order_status_history` table. | the timeline card shows the one event it can prove (the order's creation) and says the rest is not recorded | §3.3 |
| **Internal notes** | **NOT REAL.** No notes entity. `orders.notes` is a single customer-facing TEXT column. | the notes card says the store has no place to keep an internal note yet | §3.4 |
| **Variant on the order line** | **NOT REAL.** `OrderItemResponse` carries the SKU but not the chosen options (weight, grind). | the line shows the name and the SKU | the chosen option values on the order line, or a join from the variant |

## 5. The frontend work that follows the approval

Once the backend work is agreed, the frontend has:

1. **the activity timeline** — every event (status change, payment, refund,
   note, e-mail) with its time, its actor and its note, newest first, fed by
   `GET /orders/{id}/history` + the notes + the payment;
2. **the note composer** — internal by default, `POST /orders/{id}/notes`;
3. **the shipment form** — shown when the order moves to `SHIPPED`, and
   `PUT /orders/{id}/shipment`;
4. **the refund dialog, enabled** — full or partial, with a reason, calling
   `POST /orders/{id}/refund`;
5. **the "notify customer" toggle, enabled** — inside the status dialog,
   sending `notifyCustomer: true`;
6. **the stats endpoint wired to the cards** — `GET /orders/stats`, so the
   cards no longer need the whole set;
7. **the server-side filters** — `search`, `paymentStatus`, `paymentMethod`,
   `dateFrom`, `dateTo` on the list endpoint, so the browser stops doing the
   filtering.

The frontend pieces that need NO backend change are already built: the
progress tracker, the status dialog with the strict transition matrix, the
cancel dialog with its required reason, the totals card with its mismatch
warning, and the honest "not available yet" lines.

## 6. The decisions the approval needs

1. **Is `SHIPPED → CANCELLED` allowed?** (§2.1) The strict map says no; a
   store usually wants it. This changes the strict map, the endpoint and
   the dialog.
2. **Is a status change allowed to go BACKWARDS?** The strict map says no
   (`PROCESSING → CONFIRMED` is refused). The current endpoint allows it.
3. **Who is `changed_by`?** The email of the admin, the id, or the display
   name? The frontend shows it as "by {actor}".
4. **Is a refund partial?** The dialog offers full or partial, and the
   contract in §3.6 carries an amount — so partial is assumed. A full
   refund could be a separate endpoint.
5. **Does the status change send an e-mail?** YES — it is built: the
   change publishes an event, and the e-mail is enqueued after the
   transaction commits. What it still needs is the Brevo TEMPLATE (the id
   comes from `BREVO_TEMPLATE_ORDER_STATUS_CHANGED`).
6. **Are the tags worth the table?** The ticket lists them in the sidebar;
   the backend has nothing.
