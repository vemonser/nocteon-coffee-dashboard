# Orders list v4 — the numbers, the table, the filters

**Date:** 2026-10-22
**Repos:** `nocteon-dashboard` (Angular 22) + `nocteon-backend` (Spring Boot 4.1 / Java 21)
**Branch:** `ui/orders-list-v4` (dashboard) · `feat/orders-list-v4` (backend)

---

## 1. Why this exists

The orders list was audited against a written spec and the audit found six
classes of defect:

1. **The KPI numbers came from the wrong place.** `orders.stats.revenue`,
   `orders.stats.avgOrderValue` and `orders.stats.cancelRate` do not exist in
   `en.json` or `ar.json` — the screen renders the raw keys. The values behind
   them were computed by reading the WHOLE filtered set from the browser
   (`size: 1000`), a read the service silently clamps to 100 rows. Revenue was
   summed over the set *with* the status tab while the cancel rate's
   denominator came from the set *without* it: two cards, two sets.
2. **The formulas were wrong.** AOV was `revenue ÷ every order` (so cancelled
   orders dragged the average down) instead of `revenue ÷ the orders that
   entered the revenue`.
3. **The table lost information.** The Customer column was budgeted at 92px
   (truncated), Created at rendered on two lines, the Items column showed a
   stack of thumbnails instead of a count, an order with no items rendered a
   silent "No items", and a cancelled cash-on-delivery order claimed its
   payment had "Failed".
4. **The export exported the page, not the result.** `exportCsv()` wrote
   `this.rows()` — the twenty rows on screen — while the tooltip promised "the
   N orders matching the current filters".
5. **The tab strip did not match the spec.** It showed the six backend order
   statuses (including `Confirmed`) and had no `Refunded` tab.
6. **The seed had two broken orders.** `ORD-2026-000009` has no line items
   and therefore a total of `0.00`; the cancelled cash-on-delivery orders
   carry `payment_status = FAILED`, which is not a thing a COD payment can do.

The rule the whole page runs on: **the browser never filters a page of rows it
happens to have.** Every count, every search and every filter is the
backend's.

---

## 2. The scope model — one set, one exception

Two sets, named once, used everywhere.

**The filtered set** = the date range + the payment status + the payment
method + the search term. It does NOT include the status tab.

**The view** = the filtered set ∩ the selected tab.

| Surface | Set | Where the number comes from |
|---|---|---|
| The table rows | the view | `GET /api/dashboard/orders` — `content` |
| The pager's `1-10 of 17` | the view | the same call — `totalElements` |
| The header count | the view | the same call — `totalElements` |
| The four KPI cards | the view | `GET /api/dashboard/orders/stats` with the tab |
| The tab counts | the filtered set | the same call, without the tab |

The tab counts are the one exception, and deliberately so: they are **facet
counts**. A tab answers "how many of this status match my filters?", and if
the count were taken from the view, clicking `Cancelled` would zero every
other tab and the strip would be useless.

The consequence that matters: **a card can never contradict the rows under
it.** Both describe the view. The cards change when the tab changes, exactly
as the rows do.

### 2.1 The scope note

The header's scope note becomes filter-aware, because the old one
(`orders.orderScope.allHelp` = "Every order the store has…") is a lie the
moment a filter is on.

| State | The note says |
|---|---|
| No filters, no tab | "Every order in the store." |
| Filters, no tab | "The orders matching your filters." |
| A tab is selected | "The {{status}} orders matching your filters." |

The count itself is the view's count in every case — it is the same number the
pager shows.

---

## 3. The backend contract

### 3.1 Two new fields on the stats endpoint

`GET /api/dashboard/orders/stats` (`OrderStatsResponse`) gains:

```java
/** The money the set brought in: the paid orders, less the refunds. */
private BigDecimal revenue;

/** How many orders the revenue was summed over. */
private long revenueOrderCount;
```

Nothing is removed, so the endpoint stays backward compatible. The existing
`total`, `byStatus`, `byPaymentStatus` and `byPaymentMethod` keep their
meaning: **the stats of the filter you send.** The endpoint does not mix
scopes; the frontend asks it twice.

### 3.2 How the revenue is computed

```
revenue          = SUM(total_amount) over the paid, non-cancelled orders of the set
                 − SUM(refunds.amount) of those same orders
revenueOrderCount = the number of those orders
```

* "Paid" = `payment_status = 'PAID'`. A refunded order is no longer paid, so it
  does not enter the sum at all — which is what "after deducting the refunds"
  means for a full refund. A *partially* refunded order that is still marked
  PAID enters the sum and its refund is subtracted.
* Cancelled orders never enter the sum, whatever their payment status.
* The predicate is the same one the row query uses, so the money and the rows
  describe the same set.

The aggregate is one SQL query, not a read of the rows. There is no full read
of the orders anywhere in the flow.

### 3.3 Two requests, two scopes

```
facets  = GET /api/dashboard/orders/stats?{filters without the tab}
cards   = GET /api/dashboard/orders/stats?{filters with the tab}
rows    = GET /api/dashboard/orders?{filters with the tab}&page&size&sort&direction
```

When no tab is selected the two stats calls carry the same parameters and the
second is skipped — the first response answers both.

### 3.4 `NOT_COLLECTED`

`PaymentStatus` gains `NOT_COLLECTED`. `orders.payment_status` is a
`VARCHAR(50)`, so no column migration is needed.

* The cancellation flow sets `NOT_COLLECTED` on a cancelled cash-on-delivery
  order whose payment was never captured. Money that was never collected
  cannot have failed.
* An order cancelled after an online payment attempt keeps `FAILED` — the
  attempt really did fail.
* The frontend applies the same rule as a safety net (see §6.3), so the screen
  is correct even against a database that has not been migrated yet.

---

## 4. The KPI cards

Four cards, in this order, in a `grid-cols-2 md:grid-cols-4` strip, each
72px tall as today.

| Card | Value | Formula | Tooltip (EN) |
|---|---|---|---|
| Revenue | `revenue` from the backend | Σ of the paid orders, less the refunds | "The money the orders in this view brought in: the paid orders, minus the refunds, cancelled orders excluded." |
| Open orders | a count | Pending + Confirmed + Processing + Shipped | "The orders in this view that are still being fulfilled." |
| Average order value | a ratio | `revenue ÷ revenueOrderCount` | "Revenue divided by the number of paid orders it came from — cancelled orders are not part of it." |
| Cancellation rate | a percentage | `cancelled ÷ the view's total` | "The cancelled orders in this view, as a share of all the orders in it." |

Rules:

* **No raw key ever.** Every label and every tooltip has an EN and an AR
  entry. The three keys that are missing today are added.
* **No delta.** The cards carry no period-over-period figure, so there is no
  fake delta to suppress.
* **The scope is on the card.** Each tooltip states the set the number covers
  ("the orders in this view"), and the header's scope note says the same
  thing in words.
* **A zero is shown as a zero.** `0.00` is a real answer ("nothing was
  earned in this view"), not a missing value, so it is rendered as `0.00` and
  not as `—`.
* **While loading or after an error** the cards show a muted placeholder, not
  a stale `0.00` and not a spinner.

---

## 5. The tabs

Seven tabs, in this order:

`All` · `Pending` · `Processing` · `Shipped` · `Delivered` · `Cancelled` ·
`Refunded`

`Confirmed` leaves the strip: the spec named seven tabs and `Confirmed` was
not one of them. The backend status still exists and still filters — a shared
URL with `status=CONFIRMED` keeps working, it just has no tab of its own.

`Refunded` is a **payment** status, not an order status: an order that was
delivered and then refunded is still a delivered order. So the tab filters
`paymentStatus=REFUNDED` and sends no `status`. Its count comes from the
payment-status counts of the filtered set.

While the `Refunded` tab is active the payment-status select is **disabled**
and reads "Refunded", so the two controls can never contradict each other.
Switching to another tab restores the select's own value.

The URL keeps `status=` for all seven tab ids. `status=REFUNDED` is a tab id,
not an order status: the component maps it to the payment filter before it
talks to the API, so the API never receives an unknown status.

---

## 6. The table

Nine columns plus the select checkbox, in the order the spec asks for:
Order # · Customer · Items · Order status · Payment status · Method · Total ·
Created at · Actions.

| Column | Budget | What it shows |
|---|---|---|
| Order # | 140px | The order number, `tabular-nums`, a real link to the order. |
| Customer | 190px | The name (one line) and the e-mail under it (`ltr`), both truncated, with a tooltip carrying **both** the name and the e-mail. |
| Items | 84px | The count: "3 items" / "3 منتجات" (the plural pipe). |
| Order status | 112px | The badge. |
| Payment status | 128px | The badge. |
| Method | 168px | The icon and the label, never truncated. |
| Total | 110px | The money, end-aligned. |
| Created at | 124px | **One line**: the date. The relative time is in the tooltip. |
| Actions | 80px | The kebab, pinned to the inline end. |

The total is `40 (checkbox) + 140 + 190 + 84 + 112 + 128 + 168 + 110 + 124 + 80
= 1176px`. The content box at 1440 is about 1230px (`max-w-7xl` = 1280, minus
`p-6` = 48, minus the card border), so the table does not scroll sideways at
1440 and the kebab is never cut off. `minWidth` becomes `1176px`.

### 6.1 The items column

```
3 items                      ← the count, through the plural pipe
⚠ No items                   ← an order with no line items
```

An order with no items gets a **warning icon** and a tooltip that says the
order has no line items — never a silent "No items" that reads like a fact.
The count replaces the thumbnail stack: the number is what the reader needs
at a glance.

### 6.2 The zero total

An order whose recorded total is `0.00` gets a data-issue warning icon and a
tooltip: the store recorded no line items for it, so no revenue was booked.
`ORD-2026-000009` is the seeded example; the seed is also fixed (§8).

### 6.3 The payment status of a cancelled COD order

The effective payment status of a row is:

```
order.status === 'CANCELLED'
  && order.paymentMethod === 'CASH_ON_DELIVERY'
  && (paymentStatus === 'PENDING' || paymentStatus === 'FAILED')
        → NOT_COLLECTED  ("Not collected" / "لم يُحصَّل")
otherwise                    → the payment status as it is
```

The rule is one pure function, unit-tested, shared by the list and the detail
page. It agrees with the backend's `NOT_COLLECTED` value, so the two can
never show different things.

### 6.4 The badges

Both badge families use the shared `StatusBadgeComponent` and its theme
tokens (`bg-warning-soft text-warning`, `bg-success-soft text-success`,
`bg-destructive-soft text-destructive-text`, `bg-muted text-muted-foreground`,
`bg-chart-5/10 text-chart-5`). The new `notCollected` kind uses the muted
pair — the same tokens in light and in dark, and never a hard-coded colour.

---

## 7. The filters, the search, the export

* **Search** — by order number, customer name, e-mail, phone or id. The
  backend already matches all of them (`LOWER(o.orderNumber)`, the e-mail, the
  first and last name, the phone). The placeholder says so:
  "Search by order number, name or email…".
* **Date range** — All time / Today / Last 7 days / Last 30 days / Custom,
  sent as `dateFrom`/`dateTo` (inclusive calendar days, the store's own time
  zone).
* **Payment method** and **payment status** — sent as-is.
* **Sort** — Created at and Total (both sortable on the backend); the status
  columns stay sortable too.
* **Export CSV** — writes the **whole current result**, page after page
  (`getEveryOrder`): the view — the filtered set ∩ the selected tab — and not
  the twenty rows that happen to be on screen. The button is disabled while
  the export runs, and the tooltip states how many orders are exported.

---

## 8. The data fixes (the backend's migrations)

| Migration | What it does |
|---|---|
| `V112__fix_review_and_media_seed.sql` (renamed) | The repository has TWO migrations with version 111 while the live database has them as 111 and 112. A rebuild would fail to start. The second file is renamed to 112 — the version the database already knows it by. No content change. |
| `V113__cod_cancelled_payment_status.sql` | `UPDATE orders SET payment_status = 'NOT_COLLECTED' WHERE status = 'CANCELLED' AND payment_method = 'CASH_ON_DELIVERY' AND payment_status IN ('PENDING','FAILED')` — the seeded cancelled COD orders (6 and 10). |
| `V114__ord_9_line_items.sql` | `ORD-2026-000009` gets its line items and its total is recomputed with the store's own formula (`Σ lines − discount + shipping`), the same formula `V111` used. Its `0.00` total becomes a real one. |

The other orders without line items (6, 7, 10, 12, 14, 15) keep their state
on purpose: they are what exercises the "no items" warning. The audit says
the warning must exist, and a warning that never fires is not a warning.

---

## 9. The states

| State | What the reader sees |
|---|---|
| Loading | The table's skeleton rows (as today) and a placeholder in the KPI cards — never a flash of `0.00` and never a blank table. |
| Empty (the store has no orders) | "No orders yet" + the hint. |
| No results (the filters exclude everything) | "No orders match these filters" + the hint + a **Clear filters** button. |
| Error | The error card with the title, the hint and a **Retry** button (as today). The KPI cards show a placeholder, not a stale number. |

The "Clear filters" button is a new **opt-in** `emptyAction` on the shared
`DataTableComponent` — no other list changes behaviour.

---

## 10. What is NOT in this change

* The dashboard's own order count keeps its own scope (`dashboard.orderScope.paid`
  = the paid orders). The two surfaces keep their separate, documented
  definitions — the point of `core/dashboard/order-scope.ts` is that they are
  *named*, not that they are equal.
* The order DETAIL page is not rebuilt. It reads the new `NOT_COLLECTED` value
  and the shared payment-status rule, and nothing else.
* `API_GAPS.md` gaps #1 (the KPI aggregates) and #4 (the COD payment status)
  are closed; gap #3 (`refundedAmount` on the order row) stays open — the
  revenue subtracts the refunds it can see, and the detail page still reports
  "Not recorded" when no refund row exists.
* The `userId` filter stays ignored by the backend (gap #1 of the v4 notes).

---

## 11. Validation

| What | How | Gate |
|---|---|---|
| The backend compiles and its tests pass | `./mvnw verify` | must exit 0 |
| The new fields are really in the response | a live `curl` against the running container | the JSON must carry `revenue` and `revenueOrderCount` |
| The seed is fixed | a live query of the two orders | ORD-9's total ≠ 0.00; the cancelled COD orders are `NOT_COLLECTED` |
| The KPI math is right | Vitest unit tests over the pure functions | must exit 0 |
| The page behaves | the rewritten `e2e/orders.spec.ts` + `e2e/orders-states.spec.ts` | must exit 0 |
| No raw key on the screen | the existing e2e "a raw translation key never reaches the screen" | must pass |
| No horizontal scroll at 1440, in both themes | browser evidence (the measured `scrollWidth` vs `clientWidth`) | measured, not asserted by eye |
| The badges are the same tokens in light and dark | a browser screenshot of both themes | captured |
| The evidence chain is intact | the software-factory Evidence Gate | must exit 0 |

The e2e suite's existing expectation of **five** stat cards (the old set) is
replaced by the four cards of §4 — the test is rewritten to the new spec, not
weakened.

---

## 12. The file map

**Backend** (`nocteon-backend`)

```
src/main/resources/db/migration/V111__fix_review_and_media_seed.sql → V112__…
src/main/resources/db/migration/V113__cod_cancelled_payment_status.sql   (new)
src/main/resources/db/migration/V114__ord_9_line_items.sql               (new)
src/main/java/…/payment/enums/PaymentStatus.java                         (+NOT_COLLECTED)
src/main/java/…/order/service/OrderStatusService.java                    (the cancel path)
src/main/java/…/order/dto/response/OrderStatsResponse.java               (+2 fields)
src/main/java/…/order/service/OrderStatsService.java                     (the aggregates)
src/main/java/…/order/repository/OrderRepository.java                    (the aggregate queries)
src/test/java/…/order/service/OrderStatsServiceTest.java                 (new)
```

**Frontend** (`nocteon-dashboard`)

```
src/app/features/orders/models/order.model.ts                    (+NOT_COLLECTED)
src/app/features/orders/models/order-status.model.ts              (+the notCollected kind, the rule)
src/app/features/orders/utils/order-kpi.ts                       (new: the KPI math, the tab map)
src/app/features/orders/utils/order-kpi.spec.ts                  (new)
src/app/features/orders/orders-list/orders-list.component.ts      (the scope model, the tabs, the KPIs)
src/app/features/orders/orders-list/orders-list.component.html
src/app/shared/ui/status-badge/status-badge.component.ts         (+notCollected)
src/app/shared/components/data-table/data-table.component.ts      (+emptyAction)
src/app/shared/components/data-table/data-table.component.html
public/assets/i18n/en.json · ar.json                              (the labels, the tooltips, the warnings)
e2e/orders.spec.ts · e2e/orders-states.spec.ts                    (rewritten + extended)
API_GAPS.md · DECISIONS.md · SEED_PROPOSAL.md · e2e/README.md     (the truth, updated)
```
