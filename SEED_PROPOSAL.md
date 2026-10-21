# SEED_PROPOSAL.md

> Appended section: orders & carts audit (this round). See also
> `ORDERS_SEED_PROPOSAL.md` for the full 60-day order seed.

**Status: PROPOSAL ONLY. Nothing here has been run. No data was created,
modified or deleted.**

This document describes a dev-profile seed that would make the dashboard
testable: charts with a real shape, "Needs attention" with real items, and
deltas that mean something.

Every claim in the "Current data" section below was measured against the
running stack, not read from code. The measurements are reproduced in
`evidence/phase1/results.json` under `measurements.reconciliation`.

---

## 1. What the current data actually is

Measured with `GET /api/dashboard/stats/overview?days=30` and
`GET /api/dashboard/orders?page=0&size=50`:

| Fact | Value |
|---|---|
| Orders in the store | 17 |
| Orders with `paymentStatus = PAID` | 10 |
| Distinct order `createdAt` values | **1** (`2026-10-20T05:49:48.204790Z`) |
| Distinct customer emails | 5 — `admin@aurum.local`, `ahmed@…`, `mohamed@…`, `sara@…`, `nour@…` |
| Orders placed BY the admin | **2 of 17** (`ORD-2026-000001`, `ORD-2026-000006`) |
| Revenue (sum of `totalAmount`, PAID) | 1,176.25 |
| Revenue (sum of order-item `totalPrice`, PAID) | **20,826.50** |
| Orders per status | DELIVERED 8, PROCESSING 1, SHIPPED 1 (of the PAID set) |
| Cancelled / failed orders | 5 (CANCELLED) — 1 is REFUNDED |
| Low-stock products | 0 |
| Pending reviews | 0 |
| Unread contact messages | 0 |

### 1.1 The two revenue numbers are two different quantities

This is the single most important thing to understand about the current data,
and it is a **seed** problem, not a dashboard problem.

For every PAID order the seed wrote:

```
order.totalAmount  =  120.50        (a small, arbitrary number)
order items        =  1300.00 + 525.00  (the real line items)
```

`order.totalAmount` does **not** equal the sum of its own items, and it does
not include the shipping cost that the same order also carries. The seed
appears to have written `totalAmount` from a different table than the one it
wrote the items from.

Consequences, all measured:

- `totalRevenue` (1,176.25) = `SUM(order.totalAmount)` over PAID orders.
- `revenueByCategory` / `revenueByOrigin` / `revenueByRoastLevel` (20,826.50)
  = `SUM(orderItem.totalPrice)` over PAID orders — the **line items**.
- `topSellingProducts[].price` = the **lowest variant price** of the product
  (650, 600, 525, 450), while `quantitySold` is the true sold quantity. So
  `8 × 650 + 8 × 600 + 7 × 525 + 5 × 450 = 15,925` is a third number, and it
  matches neither of the other two.
- The `percentage` field the backend computes for the category donut is
  `lineItemRevenue / orderTotalRevenue × 100` = 20,826.50 / 1,176.25 =
  **1,770.6 %**. A percentage above 100 % is the tell.

**None of these three can be reconciled until the seed writes an order whose
`totalAmount` equals its items + shipping − discount.**

### 1.2 The previous period is empty, not zero

Every order is dated 2026-10-20. The previous 30-day window (2026-08-22 …
2026-09-20) contains **no orders at all**, so the truthful previous-period
revenue is 0, not 1,176.25. Before the Phase 1 fix, the dashboard reported a
flat `0.0 %` for four KPIs — which was an artefact of the backend's
`previous` block, not a real "no change" (see `DECISIONS.md`, Phase 1).

---

## 2. What the dev-profile seed should create

Target: a coffee store that has been trading for ~60 days, so every chart has
a shape and every delta is meaningful.

### 2.1 Orders — 60 days, 8–14 per week, tapering

| Property | Value |
|---|---|
| Date range | 2026-08-22 … 2026-10-20 (60 days) |
| Order count | 120–180 |
| Orders per day | 2–4, with a weekend bump and a mild upward trend |
| Timestamps | Spread over the working day, 09:00–22:00 Cairo time |
| Amounts | Log-normal-ish, 120 – 1,400 per order, ~2 decimals |
| Shipping | 50, waived above the store's free-shipping threshold (500) on some orders |
| Discount | 0 on most orders; every 7th order has 5–15 % off |
| Tax | 0 (the store model has no tax column today) |

**Rule that must hold for every seeded order:**

```
order.totalAmount == SUM(item.totalPrice) + shippingCost - discountAmount
```

This is the invariant the current seed violates, and it is the reason three
widgets disagree. It should be asserted by the seeder, not assumed.

### 2.2 Order statuses — all of them, in realistic proportions

| Status | Share of orders | Notes |
|---|---|---|
| DELIVERED | 55 % | spread across the whole 60 days |
| SHIPPED | 12 % | recent 5 days mostly |
| PROCESSING | 10 % | last 3 days |
| CONFIRMED | 8 % | last 2 days |
| PENDING | 5 % | last 24 h |
| CANCELLED | 10 % | spread out, with `paymentStatus = FAILED` |

A **pending** order is explicitly required: it is what drives the "Pending
orders" tile in Needs attention, and it is the only way to test that tile.

### 2.3 Payment methods and statuses

| Payment method | Share |
|---|---|
| ONLINE | 70 % |
| CASH_ON_DELIVERY | 30 % |

| Payment status | Share | Paired with |
|---|---|---|
| PAID | 88 % | DELIVERED / SHIPPED / PROCESSING / CONFIRMED |
| PENDING | 5 % | PENDING / CONFIRMED |
| FAILED | 4 % | CANCELLED |
| REFUNDED | 3 % | DELIVERED (a delivered order that was later refunded) |

This gives a real refund rate of ~3 % of PAID orders (≈ 5 refunded out of
~160), so the "Refund rate" card shows a percentage that is neither 0 % nor
20 %, and the status chart and the refund metric can be checked against each
other.

### 2.4 Customers — 24, and never the admin

- 24 accounts with role `CUSTOMER`, distinct emails
  (`customer01@…` … `customer24@…`), distinct names, distinct addresses.
- `createdAt` spread over the 60 days, so `userGrowth.currentPeriodCount` and
  `previousPeriodCount` are both non-zero and the "New customers" delta is a
  real percentage rather than "New".
- 3 of them are repeat buyers (2+ orders), so "Repeat purchase rate" is a
  meaningful fraction of the customer base.
- **The admin account (`admin@aurum.local`) is never a customer.** Today two
  of the seventeen orders belong to the admin, so "Admin Aurum" appears at
  the top of Recent Orders — a store owner buying from their own store.

### 2.5 Products, stock and the "needs attention" tiles

| Item | Count | Why |
|---|---|---|
| Low-stock product | 2 | `stockQuantity <= reorderThreshold` → drives the "Low stock" tile and the Low Stock Products widget |
| Product with a pending review | 1 | `isApproved = false` → drives the "Reviews awaiting moderation" tile |
| Unread contact message | 1 | `isRead = false` → drives the "Unread messages" tile |
| Out-of-stock product | 1 | `stockQuantity = 0` |
| Product on sale | 2 | `discountPercentage > 0` |

### 2.6 Catalog coverage

- 4–6 coffee products across **3 different categories** (so the category
  breakdown is a real breakdown, not one slice), **3–4 origins**, and
  **3 roast levels** (so the origin and roast widgets have more than one
  slice and the "one category → single stat" rule can be exercised).
- Each product has 2–3 variants (250 g / 500 g, whole bean / espresso), so
  `coffeeSoldKg` is a real weighted quantity, not a unit count.
- 2–3 equipment products, so `coffeeSoldKg` (which filters
  `productType = COFFEE`) differs from the raw item revenue — which is
  exactly the case the current seed cannot show.

---

## 3. What this seed would let us verify

| Ticket | Currently | With the seed |
|---|---|---|
| X1.2 revenue reconciliation | 1,176.25 vs 20,826.50 vs 15,925 — three numbers, no order total matches the items | one number, and the reconciliation table shows the same figure from every widget |
| X1.1 previous period | previous window is empty, so every delta is "New" or 0.0 % | non-empty previous window, real percentages |
| X3 revenue chart | one bar on one day | 60 days of shape, visible spike, visible comparison line |
| X3 needs-attention panel | always "all clear" | four live tiles |
| X3 donut → tabs | one category only | 3 categories, 3 origins, 3 roast levels |
| X4 device breakdown | counts change between two loads | stable counts |
| X5 order status colours | 2 of 6 statuses ever appear | all 6 statuses present |
| X6 empty states | never reachable with real data | reachable when a range has no orders |

### 3.1 The device breakdown instability

The QA report observed the device counts changing between two loads
(`3/18/10/6/10` then `9/6/15/10/18` — a total of 47 vs 58).

Measured behaviour: **back-to-back loads return identical counts**, but the
counts grow over time. The table is **cumulative** — it records a row per
observed device — so a store that has been open longer simply has more rows.
The QA observation is therefore not a race or a randomisation; it is the
same total measured at two different moments.

**This is a question, not a fix:** what is a "device" row supposed to
represent — a session, a user, or a request? A cumulative counter of
sessions and a cumulative counter of devices answer very different
questions, and the dashboard cannot label the widget correctly until that
is settled. The seed proposal therefore does not attempt to change it.

---

## 4. How the seed should be run (when it is approved)

- **A separate profile.** `application-devprofile.yml`, active only under an
  explicit Spring profile, so it can never touch a real database.
- **Idempotent.** Every entity carries a deterministic slug/email
  (`dev-customer-01@…`, `dev-product-01`), so re-running updates rather than
  duplicates.
- **A transaction that rolls back on any invariant failure** — in particular
  the `totalAmount` invariant in 2.1. A seed that writes an inconsistent
  order is worse than no seed.
- **Idempotent against a running server**: it must not require the API to be
  stopped, and it must not delete anything that already exists.

## 5. Explicitly out of scope

- No change to the live database in this phase.
- No change to the backend's aggregation queries (that is a separate
  decision, tracked in `evidence/phase1/results.json` →
  `measurements.missingBackendContracts`).
- No attempt to make the device breakdown stable (see 3.1).

---

## Orders & carts audit (this round)

**Status: PROPOSAL ONLY. Nothing here has been run.**

### Orders

1. **Orders with no items but a total of 40/50 (shipping only)** — orders
   6, 7, 9, 10, 12, 14, 15. Cause: no `order_items` rows in the seed
   (data defect, not an API omission). Proposed: seed at least one line item
   per order, or mark shipping-only orders explicitly.
2. **ORD-000009**: Delivered + Refunded + total 0.00. The total must stay
   the original; add a `refundedAmount` field and show "Refunded EGP x".
3. **Paid orders with empty `paidAt` and transaction reference** — propose
   populating both on PAID. Frontend shows a data warning when missing.
4. **COD + Cancelled shows payment "Failed"** — COD cannot fail. Propose
   `NOT_COLLECTED` payment status (see API_GAPS.md #4).
5. **Cart prices (12.50/14/11) vs order prices (650/525)** — currency or
   scale mismatch. Propose a single currency (EGP) and scale (see API_GAPS.md #10).
6. **SKU format mismatch**: orders use `SKU-1-1`, carts use `SKU-001`. Propose
   `SKU-<product>-<variant>` zero-padded to 3 digits (API_GAPS.md #9).
7. **All orders share one timestamp (8:49 AM)** — propose spread timestamps
   and sample events so history can be demonstrated (ORDERS_SEED_PROPOSAL.md).

- Verified purchase audit: verified = reviewer has a Delivered order containing that product. Seed data should be reconciled so `verified` matches `orderId`/`orderNumber` presence; mismatches (verified true without order, or order present but not delivered) should be corrected in the seed.
- Reviewer usernames are lowercase in seed; display proper-casing is applied in the UI, but seed could store display names if full names are added later.

## Order details v3 (ui/order-details-v3)

The detail page was verified against the 17 seeded orders. These data defects
make the page (and any UAT of it) weaker than the UI; none of them are worked
around by inventing data in the frontend.

### 1. Every order has the same `createdAt`

All 17 orders report `createdAt = 2026-10-20T05:49:48.204790Z`. Every timeline
therefore starts at the same instant, ordering is untestable, and the list's
"newest first" sort cannot be seen. The seed should spread creation over
several weeks and make each transition later than the previous one.

### 2. SHIPPED and DELIVERED orders have no shipment

`OrderResponse.shipment` is `null` for every order, including the SHIPPED and
DELIVERED ones, and `shippedAt`/`deliveredAt` are always null. The page now
flags this ("marked shipped or delivered, but no shipment is recorded"), but a
UAT of the shipment card and the stepper's step dates is impossible without
seed rows. Proposed: one order per fulfilment stage with a carrier, tracking
number, tracking URL, `shippedAt`, `deliveredAt` and an ETA.

### 3. PAID orders have no payment facts

`paidAt` and `transactionReference` are null on every PAID order (the page
warns about it on each one). The seed should set both for the ONLINE paid
orders, and `paidAt` for the COD-paid order (collected at delivery).

### 4. A REFUNDED order has no refund line

Order 9 is DELIVERED + REFUNDED but its payment returns
`amount: 0, netPaid: null, refunds: []`. The UI correctly shows the refunded
amount as "Not recorded", but this is the one state where the settlement cannot
be checked. Proposed: a refund row (amount, reason, `createdAt`, `createdBy`)
for every REFUNDED order, plus one partial refund to exercise the balance.

### 5. Order lines have no items on seven orders

Orders 6, 7, 9, 10, 12, 14 and 15 have no `order_items` rows; their totals are
shipping-only (and order 9's total is `0.00` while it is DELIVERED + REFUNDED).
The empty-items state is real and useful, but most orders should carry items so
the items card, variant join and per-line prices are exercised. Keep at most
one shipping-only order.

### 6. The SKU format disagrees between order lines and the catalog

Order lines return `SKU-1-1` / `SKU-2-1`; the catalog and carts use
`SKU-001`-style values. The page displays the raw API value (no normalisation),
so the same product shows two different SKUs on two screens. The seed should
store the catalog's SKU on the order line, or the backend should copy it at
order creation.

### 7. Address duplication in the seed

`city` and `state` are both `"Giza"`, and `address.fullName` / `address.phone`
repeat the customer's name and phone. The page deduplicates both for display
and hides repeats, but the seed should use distinct values (e.g. city `Giza`,
governorate `Giza Governorate`) so the address block can be checked without the
dedupe masking a data error.

### 8. States worth adding for UAT

The set today covers Delivered+Paid (1), Shipped+Paid (8), Cancelled+Failed (6),
Delivered+Refunded (9) and Confirmed+COD pending with no items (15). Missing:
a Processing order, a Pending order, a SHIPPED order with a real shipment, a
partial refund, a COD order paid at delivery, and an order with a recorded
history (creation + transitions + actor + note).
