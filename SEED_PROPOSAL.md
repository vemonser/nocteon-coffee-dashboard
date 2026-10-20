# SEED_PROPOSAL.md

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

## Contact & reviews seed proposal (ui/contact-reviews-v2)

- Spread timestamps across rows (currently identical).
- Contact message referencing "#12345" should use real `ORD-2026-xxxxxx` format.
- Include at least one replied message with a reply thread.
- One rejected review if backend supports it (currently not supported).
- One long review comment and one long product name for truncation testing.
- Verified purchase = reviewer has a Delivered order containing that product; audit seed against it.
- Reviewer username vs full name: decide source of truth (Orders show full name).
