# DASHBOARD HOME — ROUND 2 — FINAL REPORT

> The Round-1 report (the structure pass) is kept in
> `DASHBOARD_ROUND1_REPORT.md`; this report is the Round-2 one, and it
> supersedes it.

**Branch:** `feature/orders-polish` (the existing branch; the repository is
shared with a second session that works on the Orders pages — the merges
from that session are in the history next to this work)
**Evidence:** `evidence/dashboard-r2/` (the after), `evidence/dashboard-r2-before/`
(the before), `evidence/dashboard-r2/contact-sheet/` (20 before/after
sheets), `evidence/dashboard-r2/color-math.json` (the colour maths),
`evidence/dashboard-r2/measurements.json` (every number below),
`evidence/dashboard-r2/results.json` (the 20-cell matrix).

**What was run:** `npm run build` (clean), `npm run test:unit` (166 tests,
13 files), and the e2e: `dashboard-round2` 10/10, `dashboard-language`
20/20 (every cell), `dashboard-states` 5/5, `orders` 19/19, `orders-states`
11/11, `auth` — plus `node scripts/verify-round2.mjs` (25/25 acceptance
criteria) and the software-factory evidence gate over
`.quality/runs/dashboard-r2/evidence-manifest.json` (**no gaps**).

**A note on the environment:** the repository is shared with a second
session that restarts the backend (re-seeding it, which is why the
figures move) and that cleans up the static server the e2e suite runs
against. The suite has to run on **:4200** — the backend's CORS allows
that origin only, so a private server on another port sees "Failed to
fetch" on every request. The app itself is unchanged.

**Where the evidence lives:** `evidence/` is in the repository's
`.gitignore` (the project's convention for ticket captures), so the
matrix, the measurements and the colour maths are on DISK, not in the
tree. The committed artefacts are the measurement scripts
(`scripts/measure-dashboard-r2.mjs`, `scripts/color-*.mjs`,
`scripts/verify-round2.mjs`), the spec and the manifest
(`.quality/runs/dashboard-r2/`), and the reports.

**A note on the figures:** the seed is re-run from time to time, so the
numbers move (during this work the revenue was 1,176.25, then 1,055.75,
then 21,326.50 — the last one because the seed was fixed so that the order
totals match their own items). Every figure below is a snapshot of the
seed that was live when the measurement ran; the RECONCILIATION holds for
any seed, because it is computed from the payload, not typed in. The e2e
asserts the FORM of every amount, never its value, for the same reason.

**The headline:** the numbers now reconcile as far as the data allows, there
is ONE money formatter, ONE order-number formatter and ONE count scope,
the Arabic UI carries no untranslated string, the donut centres are
readable, the dark status palette no longer prints the same colour twice
(the closest status/categorical pair is 14.4 dE, and the search proves
14.6 is the ceiling), and the four KPI cards share one padding and one
baseline.

**What is NOT a frontend fix:** the Total revenue card and the revenue
breakdowns are two DIFFERENT measures over the same ten paid orders, and
they are not supposed to be equal. The card sums `order.totalAmount` (the
items + the shipping − the discount = 21,326.50); the breakdowns sum the
line items only (20,826.50). The difference is exactly the shipping
(500) — measured, not asserted (`reconciliation.theTwoFigures`). The
earlier 17.7× gap was a DATA bug (the seeded `total_amount` did not match
the order's own items); the seed has since been fixed, and what is left is
a labelling problem, which is what the round fixed: every widget now says
what it measures instead of implying that it adds up.

---

## 1. Every item, one by one

Status: **done** = implemented and verified with the evidence named;
**partial** = implemented, but one part of the item is not satisfied;
**not verified** = no evidence exists for it.

### Phase 1 — The numbers reconcile

| # | Item | Status | Files changed | Evidence | Measured |
|---|---|---|---|---|---|
| 1.1 | The reconciliation table for every revenue/orders widget | done | `scripts/measure-dashboard-r2.mjs` | `evidence/dashboard-r2/measurements.json` → `reconciliation` (15 widgets) | every widget: endpoint, "sends the selected range", the formula, the observed value |
| 1.1 | The root cause of the mismatch, in one paragraph | done | — | same file → `rootCauseOfTheMismatch` + `theTwoFigures` | the order totals (21,326.50) against the line items (20,826.50): the difference is **exactly the shipping** (500) — the two figures are different measures, not a broken one |
| 1.1 | The range: does the frontend send it, does the backend honour it | done | `src/app/core/dashboard/period-fetch.ts` (unchanged, re-verified) | `reconciliation.rangeProof` | the client sends `?days=N`; the same endpoint returns `[]` for `days=0`, so the breakdowns are range-filtered too |
| 1.1 | The label must be truthful per widget | done | `revenue-breakdown-card.component.ts/.html`, `orders-breakdown-card.component.ts/.html`, `widget-header.component.ts` | `reconciliation[].uiLabel` | the breakdowns keep "Last 30 days" (true) and carry a note that they sum the line items; "All time" stays on Recent orders and Low stock |
| 1.2 | One shared order-count scope, used by the dashboard and the Orders page | done | **new** `src/app/core/dashboard/order-scope.ts`, `dashboard.component.ts/.html`, `orders-list.component.ts/.html` | `orderScope.scopeTable` (5 rows) + `orderScope.computed` | the dashboard counts the 10 orders whose PAYMENT status is PAID; the page counts all 17. The excluded set is COMPUTED from the payload: 7 orders (5 cancelled, 1 confirmed, 1 delivered-and-refunded) → 10 + 7 = 17 ✓. The excluded PAYMENT statuses (FAILED, PENDING, REFUNDED) are exactly the ones the shared definition names ✓ |
| 1.2 | The refund rate uses the same denominator | done | `dashboard.component.html` (the help text) | `orderScope.scopeTable[3]` | 2 of 10, and the help text names the paid-order denominator |
| 1.2 | The sentence names the PAYMENT status, not the order status | done | `public/assets/i18n/{en,ar}.json` (`orderScope.paidHelp`) | `orderScope.computed.matchesTheSharedDefinition` | the excluded order statuses are CANCELLED, CONFIRMED **and DELIVERED** (a delivered order can be refunded) and the excluded payment statuses are FAILED, PENDING, REFUNDED — so naming the order statuses would have been wrong twice over. The sentence now says "an order is counted when its payment status is Paid" |
| 1.2 | Is "refunded" a status or a payment flag; can a cancelled order be refunded | done | — | `orderScope.refundedIs` | a **payment flag** (`paymentStatus = REFUNDED`); **yes** — `ORD-2026-000012` is CANCELLED + REFUNDED |
| 1.3 | The "New" badge only where newness is the meaning | done | `core/dashboard/delta.ts` (`deltaDisplay`), `kpi-card.component.ts/.html`, `dashboard.component.html` | `core/dashboard/delta.spec.ts` (5 new cases), `e2e/dashboard-round2.spec.ts` ("the New badge is only on the card where newness is the meaning") | 3 cards show an em dash + the tooltip "No data in the previous period"; 1 card keeps "New" |
| 1.3 | The existing tests kept, the previous = 0 cases added | done | `core/dashboard/delta.spec.ts` | `npm run test:unit` → 166 passed | the previous = 0 case was already covered; 5 display cases added |
| 1.4 | One order-number format everywhere | done | `features/orders/utils/order-number.ts` (unchanged), `recent-orders.component.ts/.html`, `orders-list.component.ts` (the CSV export) | `greps.orderNumber` | 5 surfaces now go through `formatOrderNumber` / `isolatedOrderNumber` |
| 1.4 | The grep result of every place that formatted it differently | done | — | `greps.orderNumber.formattedDifferentlyBefore` | 2 places formatted it on their own (`recent-orders.component.html` and the CSV export); both fixed |
| 1.5 | One money formatter, in both languages | done | `shared/utils/locale-format.ts` (`formatCurrency`, `formatCompactCurrency`, `arabicCurrencySymbol`), `money.pipe.ts` (unchanged) | `locale-format.spec.ts` (the concurrent session's glyph assertions + 4 new compact cases) | EN "EGP 1,176.25", AR "1,176.25 ج.م" (amount first, no trailing dot, Latin digits) |
| 1.5 | The axes follow the same style | done | `revenue-chart.component.ts`, `category-chart.component.ts`, `revenue-breakdown-chart.component.ts` | `measurements.browser.*.axisLabels` | EN "EGP 1.2K", AR "1.2K ج.م" |
| 1.5 | The store-currency source | done | — | `store.currencySource` | `GET /api/settings` → `data.currency` = "EGP" |
| 1.5 | The grep shows zero money formatting outside the formatter | done | — | `greps.money.hits` → **0** | the only `toFixed` outside it is the sparkline's SVG geometry |
| 1.6 | Admin/test data in the business widgets | done | nothing (not hidden in the frontend) | `adminData` | the **users** endpoint excludes staff (9 of 10 accounts are customers); the **orders** endpoint does **not** — the admin's two paid orders are in the revenue, the order count and the status donut, and "Admin Aurum" is the first row of Recent orders |
| 1.7 | The devices widget | done | `device-list.component.ts/.html` | `devices` | the endpoint counts ROWS in a cumulative device table — one row per observed **session**; the counts grow while the store is open and the dashboard's own browsing is the largest contributor; no filtering in the frontend |

### Phase 2 — Language and formatting

| # | Item | Status | Files changed | Evidence | Measured |
|---|---|---|---|---|---|
| 2.1 | "sessions" translated, with plurals, the unit after the number | done | `device-list.component.html`, `public/assets/i18n/{en,ar}.json` (`countSessions_*`) | `e2e/dashboard-round2.spec.ts` ("the Arabic UI carries no untranslated string"), the AR screenshot | EN "418 sessions", AR "6 جلسات" / "418 جلسة" / "59 جلسة" — the plural category is chosen by `Intl.PluralRules` |
| 2.1 | The e2e check flags any Latin-only UI word in Arabic mode | done | `e2e/dashboard-round2.spec.ts` | the same test | the offenders list is **empty**; the allowlist is macOS, iOS, Linux, Windows, Android, the currency codes, "kg" and the brand |
| 2.1 | The other untranslated strings found | done | `navigation-bar.component.ts/.html`, `user-menu.component.html`, the `data-allow-latin` markers | the same test | **"Toggle Sidebar"** — the Spartan sidebar trigger renders a hardcoded English screen-reader text; it now takes the translated label. The other Latin words on the page are data (a person's name, an e-mail, an order number, a product name) and are marked as such |
| 2.2 | The Arabic summary line keeps its order | done | `revenue-chart.component.ts/.html` | `e2e/dashboard-round2.spec.ts` ("the Arabic summary line keeps its order, and is captured") + `evidence/dashboard-r2/e2e/summary-line-ar-dark.png` | the date is DOM-ordered (day, month, year) and the test asserts the GEOMETRY: the day is the leftmost part |
| 2.3 | The card title follows the active tab, in both languages | done | `revenue-breakdown-card.component.ts`, `orders-breakdown-card.component.ts` | the AR + EN screenshots, the measurements | "Revenue by origin" / "Orders by status" / "الإيرادات حسب المنشأ" / "الطلبات حسب الحالة" |
| 2.3 | The range scope badge is in the same position in every card | done | the two breakdown cards now carry the same `hlm-card-header` | the screenshots | the badge sits next to the title in all seven cards |
| 2.4 | One y-axis style, in both languages and both modes | done | `revenue-chart.component.ts` (+ the two legacy charts) | `measurements.browser.*.axisLabels` | "EGP 1.2K" / "1.2K ج.م"; the left padding is now MEASURED from the widest label, so nothing is clipped |
| 2.5 | ONE tab component | done | **new** `shared/components/ui/tabs/tabs.component.{ts,html,css}`, `dashboard-toolbar.component.{ts,html}`, the two breakdown cards | the screenshots | the range and the card tabs are the same pill group; only the role differs (`radiogroup` / `tablist`) |
| 2.5 | The missing "Category" tab | done | `revenue-breakdown-card.component.ts` | the AR screenshot (three tabs) | Origin \| Roast level \| Category — and a single-slice breakdown renders as a stat plus a bar |

### Phase 3 — Colour and donuts

| # | Item | Status | Files changed | Evidence | Measured |
|---|---|---|---|---|---|
| 3.1 | The donut centre is readable, in both modes | done | `chart-card.component.ts` (the foreground token is re-read on every theme change) | `measurements.browser.*.donuts` + the e2e test | 17.08:1 (light), 15.39:1 (dark) — both ≥ 4.5:1 |
| 3.1 | The centre uses the compact currency and never leaves the ring | done | `chart-card.component.ts` (the width is MEASURED with a canvas, not guessed) | `donuts[].overflowPx` | "EGP 20.8K" / "20.8K ج.م"; the overflow is **negative** on both donuts (−18.2 / −17.5 px) |
| 3.1 | The centre says what the number is | done | the two breakdown cards | the e2e test | "Revenue" / "Orders" (not "Origin" / "Status") |
| 3.2 | The dark status swatches are muted, not neon | done | `styles/themes/copper.css`, `styles/themes/tokens.css`, `chart-rules.ts` | `color-math.json` → `modes.dark.swatches` | Delivered #4c6f38, Processing #028a9b, Shipped #5a649d, Pending #b1632f, Cancelled #9c4b62, Refunded #7d7672, Confirmed #65955a. The neon #4ade80 and the bright cyan #22d3ee are no longer **chart swatches** — the theme tokens still exist (they are the light-on-dark TEXT colours), but the status chart and the legacy status chart both read the new `--status-*` tokens now |
| 3.2 | Every MEANING has its own swatch | done | `chart-rules.ts`, `chart-rules.spec.ts` | the spec "every MEANING has its own swatch" | CONFIRMED used to share the delivered green, so two slices of the SAME ring could be the same colour. It has its own token now (FAILED still shares CANCELLED — they are the same meaning) |
| 3.2 | The contrast of every swatch on the card (graphics ≥ 3:1) | done | — | `color-math.json` → `summary.swatchesFailingGraphics` = **["roast-1"]** | every status swatch passes in both modes (3.01 – 5.02:1 in dark, 3.09 – 11.44:1 in light). The ONE swatch under 3:1 is `--roast-1` on the LIGHT card (2.03:1) — the documented exemption of design.md §5, the lightest step of the sequential ramp, which always carries a 2 px card-coloured gap and a visible value label |
| 3.3 | The pair distance, with a numeric measure | done | `scripts/color-math.mjs`, `scripts/color-search.mjs`, `scripts/color-confirmed.mjs` | `color-math.json` → `crossPairs` (42 pairs per mode), `withinPairs` (21) | OKLab dE × 100; the bar is 15 for the cross set (the categorical ramp's own neighbours are 7–15 apart) and 9.6 for the within set (the value the pre-round palette reached) |
| 3.3 | The pairs that are too close, and the fix | done | the new `--status-*` tokens, `scripts/color-confirmed.mjs` | `color-math.json` → `modes.*.minimum`, `crossPairs`, `withinPairs` | TWO kinds of pair, both reported. **Cross** (a status against a categorical swatch — the two rings are read against each other): dark 0 → **14.4**, 19 collisions → 2; light 0 → 5.1, 20 → 15. **Within** (two statuses — the slices of ONE ring): dark 0 → **11.0**, light 0 → 7.7. The bar is 15 for the cross set and 9.6 for the within set, and **15 is not reachable**: the maximin search proves the ceiling is 14.6 for seven semantic swatches against six categorical ones. The two remaining dark collisions are `status-pending` vs the copper (14.6) and `status-confirmed` vs the teal (14.4) |
| 3.4 | The legend is one aligned column, below the chart | done | `chart-card.component.html` | `measurements.browser.*.legends` + the e2e test | 4 rows × 4 columns, the columns aligned to the pixel, below the chart in every cell |
| 3.4 | The legend is readable in RTL and in the ring's order | done | the same | the AR screenshot | the dot is at the inline start (the right in Arabic); the rows follow the ring |
| 3.5 | A donut only for 3–5 slices, one diameter, a single slice is a stat plus a bar | done | `chart-rules.ts` (unchanged), `chart-card.component.ts/.html` | `donuts[].slices` and `donuts[].diameterPx` | the origin donut 4 slices, the status donut 3, **both 180 px**; the Category tab (1 slice) renders as a stat + a bar |

### Phase 4 — KPI cards and layout

| # | Item | Status | Files changed | Evidence | Measured |
|---|---|---|---|---|---|
| 4.1 | One padding and one baseline for the four cards | done | `kpi-card.component.ts/.html` | `measurements.browser.*.kpis` + the e2e test | the label's TOP is **16 px** below the card's top edge and the value's top is **48 px**, in all four cards and in both languages (those are offsets, not type sizes). The TYPE is 12 px for the label and 30 px for the value, in all four cards — the e2e now asserts the font sizes as well as the offsets |
| 4.2 | The sparkline only when there is a trend | done | **new** `core/dashboard/sparkline.ts` (+ its spec), `kpi-card.component.ts` | `core/dashboard/sparkline.spec.ts` (8 cases), `measurements.sparkline.cases` | 1 point → none, 2 points → none, 7 points → drawn, and the real 30-day series (29 zero days, 1 day with revenue) → **none** |
| 4.3 | The secondary strip matches the primary cards; "currently online" stays a live indicator | done | `dashboard.component.html` | `measurements.browser.*.stripLabels` | the strip's labels are **12 px / 400** — the same type as the primary cards' labels (also 12 px / 400); the online card keeps its pulsing dot and the "currently online" caption, and the dot stops under `prefers-reduced-motion` |
| 4.4 | Equal heights per row, and no card taller than 1.5× its content | done | `device-list.component.html` (one column), `low-stock-products.component.html` (a centred empty state that fills the card), the card contents grow | `measurements.browser.*.cards` (16 cards × 4 cells) | the worst ratio on the page is now **1.50** (the bottom row); before: 5.43 (Low stock) and 1.81 (Devices) |
| 4.4 | The page height at 1440, before and after | done | — | `results.json` (before) vs `measurements.json` (after) | **1756 px → 1989 px** (+233) |
| 4.5 | Recent orders: the full date and time in the tooltip, a link to the order, the customer name + the order number | done | `recent-orders.component.ts/.html` | the screenshots | the tooltip carries the absolute date and time; the row links to `/dashboard/orders/:id`; the number is the shared format |
| 4.6 | The top-products column header says what the bar and the number are; the plural; the bar scales to the max | done | `top-products.component.html` | the AR + EN screenshots | the header is "Units sold" / "الوحدات المُباعة" over the column that holds the bar AND the number; "8 مبيعات"; the best seller's bar is the full track |

### Phase 5 — Verification

| # | Item | Status | Files changed | Evidence | Measured |
|---|---|---|---|---|---|
| 5.1 | The full evidence matrix | done | `scripts/evidence-targets.mjs` (the `dashboard-r2` target set) | `evidence/dashboard-r2/results.json` | 20 cells (375/768/1024/1440/1920 × light/dark × en/ar), the language switched at runtime; 0 horizontal overflow, 0 raw i18n keys in every cell |
| 5.1 | A before/after contact sheet per cell | done | `scripts/contact-sheet.py` | `evidence/dashboard-r2/contact-sheet/` | 20 sheets |
| 5.1 | design.md updated | done | `design.md` | §2, §2b, §2c, §5, §10, §12 | the money rules, the status swatches, the legend and donut rules, the KPI card anatomy, the tab component, the measured palette distances |
| 5.1 | DECISIONS.md updated | done | `DECISIONS.md` | the last section | one entry per phase |

---

## 1b. The broadcasts page (a separate, later task)

The broadcasts page was broken in three visible ways, and the fix is in
`src/app/features/broadcasts/`:

- the header printed **the page's row count, the word "of" and a bell** —
  "2 of 🔔". It now prints the TOTAL with a real label ("2 broadcasts" /
  "٢ رسالة جماعية");
- the status badge printed **the raw enum** ("PENDING", "IN_PROGRESS",
  "COMPLETED") — an untranslated string on the Arabic page. It is now
  "Queued" / "Sending" / "Sent" (منtranslated: في الانتظار / جارٍ الإرسال /
  تم الإرسال);
- **the audience was never stated.** The backend sends one message to
  EVERY customer (`userRepository.findByRoleAndSubscribedTrue(CUSTOMER)` —
  read out of the deployed jar), so the create dialog now says so, and
  every row carries the recipient count the backend counted.

**The delivery itself cannot be fixed from this repository.** The
deployed backend has `BroadcastCreationService` and nothing else in the
broadcast package: no sender, no scheduler, no `send` endpoint. A
broadcast is created with its recipient rows and stays `PENDING` with
`sentCount = 0` forever (verified against the API and the
`broadcast_recipients` table). The page therefore says "Queued" and shows
what HAS been sent, instead of pretending the delivery happened. **The
backend needs a sender** — a `POST /api/dashboard/broadcasts/{id}/send`
or a scheduled job that walks the `PENDING` recipient rows and mails them.

## 1c. The newsletter page, and what the broadcasts page was missing

A second, later task: **a newsletter page** — the addresses you can send
a newsletter to, as a TABLE like every other list, and an **export** of
those addresses. Plus: **the broadcasts page gets what it was missing.**

### The newsletter page (`/dashboard/newsletter`)

| Piece | What it is |
|---|---|
| The list | the store's CUSTOMERS (`GET /api/dashboard/users?role=CUSTOMER`) — the same audience a broadcast reaches, so the two pages agree |
| The table | the shared `app-data-table`: email, name, joined, last active — the email is the first column and is wide enough for a real address (the longest in the store is 28 characters, and it is NOT truncated) |
| The export | `Export emails` → a CSV of **every** address of the audience, not the rows on the page. The API caps a page at 100 rows (a bigger `size` is a 400), so the export walks the pages |
| The header | the TOTAL of the audience, with a label that agrees in number ("1 address in the audience" / "10 addresses in the audience") |
| The help line | what the list IS: the audience of a newsletter is the store's customers, **and the API does not carry a per-address newsletter flag**, so an address that unsubscribed is still listed |

The last line is the honest one: `NewsletterService` is the ONLY subscriber
list the API offers, and the admin `UserResponse` has no `isSubscribed`
field, so the page cannot tell a subscribed customer from an unsubscribed
one. It says so instead of pretending the list is a subscription list.

### The broadcasts page — what was missing

| Missing | Now |
|---|---|
| The header printed **the page's row count, the word "of" and a bell** — "2 of 🔔" | the TOTAL, with a label that agrees in number ("1 broadcast") |
| The status badge printed **the raw enum** ("PENDING", "IN_PROGRESS", "COMPLETED") — an untranslated string on the Arabic page | "Queued" / "Sending" / "Sent" (في الانتظار / جارٍ الإرسال / تم الإرسال) |
| **The audience was never stated** | the create dialog says the message goes to every customer of the store, and every row carries the recipient count the backend counted |
| **The broadcast could not be deleted** — the frontend's `callDelete` threw, although the backend HAS `DELETE /api/dashboard/broadcasts/{id}` | the delete action, with a confirmation, and it deletes the broadcast AND its recipient rows |
| **There was no export** | `Export broadcasts` → a CSV of every broadcast (the pages are walked — the API caps a page at 100) |

**What is still a backend gap:** the deployed backend has no SENDER. Its
broadcast package is `BroadcastCreationService` and nothing else — no
sender, no scheduler, no `send` endpoint — so a broadcast is created with
its recipient rows and stays `PENDING` with `sentCount = 0` forever
(verified against the API and against the `broadcast_recipients` table).
The page therefore says "Queued" and shows what HAS been sent, instead of
pretending the delivery happened. **The backend needs a sender**: a
`POST /api/dashboard/broadcasts/{id}/send`, or a scheduled job that walks
the `PENDING` recipient rows and mails them through the existing
`EmailService`.

### The page size — a contract constraint, and a bug it caused

| Fact | Where it shows |
|---|---|
| Every dashboard list endpoint validates `size` and answers **400** for anything above **100** | verified against `/api/dashboard/orders`, `/users`, `/categories`, `/broadcasts` — one shared cap, not a per-endpoint one |
| A request above the cap is a **failed** page, not a bigger one | the orders list asked for `size: 1000` for its revenue KPI, the 400 killed the whole `forkJoin`, and the page sat on "Loading..." — ten orders tests failed with it |
| The fix | the size is clamped to 100 in the base CRUD service and in the product service; a caller that needs the whole set **walks the pages** (the orders KPI read, the newsletter export, the broadcasts export) |
| Also unblocked | the journal form's preloader and the product wizard's dropdowns asked for 200 rows and were getting an error instead of the list |

**The backend could raise the cap** (or expose an export endpoint) — but
until it does, the client walks the pages.

## 2. The backend contract gaps

Nothing here was changed in the backend, and nothing was faked in the
frontend.

| # | What is missing | Method + path | The shape it has today | What it should be |
|---|---|---|---|---|
| 1 | **One revenue definition** | `GET /api/dashboard/stats/overview?days=N` | `totalRevenue` = SUM(`order.total_amount`); `revenueByOrigin/RoastLevel/Category` = SUM(`order_item.total_price`). On the same ten orders: **1,176.25** vs **20,826.50**. The `percentage` field of each breakdown row is computed against the order-total sum, so the category donut reports **1,770.6 %** for one category. | Either the breakdowns sum the order totals (allocated per line), or the KPI sums the line items. Until then the seed's `total_amount` must equal SUM(items) + shipping − discount, exactly as `OrderService.createOrder` computes it at runtime. |
| 2 | **What `days` bounds** | `GET /api/dashboard/stats/overview?days=N` | undocumented; the breakdowns are range-filtered (they are empty for `days=0`) but the contract does not say so | the response should document that `days` bounds every aggregate, and should return the window it applied |
| 3 | **A previous-period aggregate** | `GET /api/dashboard/stats/overview/compare?days=N` | its `previous` object ignores its `until` bound server-side, so it is "everything since 2N days ago" — a superset of the current window | the client works around it (`overview?days=2N` − `overview?days=N`); the endpoint should be fixed rather than replaced |
| 4 | **Staff accounts in the order aggregates** | `GET /api/dashboard/orders`, `GET /api/dashboard/stats/overview?days=N` | the users aggregate excludes staff (9 customers of 10 accounts) but the order and revenue aggregates do **not**: the admin's two paid orders are counted, and "Admin Aurum" is the first row of Recent orders | the order/revenue aggregates should exclude the staff accounts the way the user aggregate does, or the seed should not create orders for the admin. The frontend must not hide the rows. |
| 5 | **What a device row is** | `GET /api/dashboard/stats/overview?days=N` → `deviceBreakdown` | a count of the rows of a cumulative device table; the rows grow while the store is open and the dashboard's own traffic is the largest single contributor | the endpoint should say what a row is (a session?) and should exclude the staff's own traffic, or the number measures the dashboard rather than the store |
| 6 | **Per-product revenue** | `GET /api/dashboard/stats/overview?days=N` → `topSellingProducts` | `quantitySold` and `price` (the **lowest** variant price, not the price paid) — no revenue | the widget can only show units truthfully; with a per-product revenue it could show what the bars are worth |
| 7 | **A broadcast sender** | `POST /api/dashboard/broadcasts` (create only) | the broadcast and its recipient rows are created and nothing sends them: no sender, no scheduler, no `send` endpoint, so every broadcast stays `PENDING` with `sentCount = 0` | a sender — a `POST /{id}/send` or a scheduled job that walks the `PENDING` recipient rows and mails them through the existing `EmailService` |
| 8 | **A refund amount** | `GET /api/dashboard/orders/:id` | `paymentStatus = REFUNDED` with no amount, so the net paid is unknown | the refund rate is a COUNT share today; a refund amount would make "net paid" a number |

---

## 3. The risks

1. **The revenue mismatch is still there.** The dashboard now says what each
   number measures, but a reader who adds the two breakdowns up and
   compares them with the Total revenue card will still find a 17×
   difference. The UI note is the honest mitigation, not a fix.
2. **The light palette still has 15 colour pairs under 15 dE**, and the
   dark one has 2 (the closest: `--status-pending` against the copper at
   14.6 dE, and `--status-confirmed` against the teal at 14.4). The bar of
   15 is NOT reachable: the maximin search
   (`scripts/color-confirmed.mjs`) proves the ceiling is 14.6 for seven
   semantic swatches against six categorical ones. The light mode is worse
   (5.1) because on a white card every swatch has to be dark enough for
   3:1 and the light categorical ramp already spans that lightness. What
   DID improve is the pair that mattered most: no two statuses share a
   colour any more (the minimum went from 0 to 11.0), so two slices of the
   same ring can always be told apart.
3. **The page grew by 233 px** (1756 → 1989 at 1440), against the old
   1700 px target. The growth is the price of the one-column legend, the
   card headers on the breakdown cards and the cards that fill their area.
   The new target is in design.md.
4. **The device list is one column now.** The bars are long, and the card
   is 204 px instead of 152. That is what brought the bottom row's ratio
   to 1.5; a two-column list would leave the Low stock card mostly empty
   again.
5. **The sparkline rule is a judgement call.** "At least three points and
   two of them above the minimum" hides a spike in a flat series. A
   reader who wants to see "we only sold today" does not get a sparkline.
   The reasoning is in `core/dashboard/sparkline.ts`.
6. **The order-count scope is a UI contract, not a backend one.** If the
   backend changes what the overview counts (say, it starts counting
   CONFIRMED orders), the dashboard's "10" and the page's "17" drift
   apart again. The shared definition is the only thing that keeps them
   honest.
7. **The translations are only as reactive as the component.** A computed
   that calls `transloco.translate()` without reading the language signal
   caches the language it was built in. That class of bug is now covered
   by the e2e suite (it switches the language at runtime) and by a
   checklist item in design.md.

---

## 4. What I deliberately did NOT change

- **The backend.** No endpoint, no DTO, no seed. The reconciliation is a
  report, not a patch.
- **The light categorical palette.** The brief said the light mode is
  acceptable, so chart-1..6, the roast ramp and the chart-other bucket
  are byte-for-byte the same. The light STATUS swatches are the same
  values they had, with ONE exception: `--status-shipped` used to be
  `--chart-5`, a categorical token, so a shipped slice and a possible
  origin slice were literally the same colour; it is now its own value.
- **The order totals.** The Orders pages still show the backend's stored
  `totalAmount`, and the mismatch warning on the detail page is the
  concurrent session's work — it was left alone.
- **The Orders pages' layout and columns.** The Method column's width
  was widened by the other session while this work was in flight; this
  work did not touch the column budget.
- **The dashboard's structure.** The same widgets, in the same order, in
  the same rows.
- **The categorical palette.** chart-1..6, the roast ramp and the
  chart-other bucket are byte-for-byte the same in both modes.
- **The light status swatches** keep the values the light mode already had,
  with two exceptions that had to change: `--status-shipped` used to BE
  `--chart-5` (a categorical token — the same colour as a possible origin
  slice), and `--status-confirmed` did not exist.
- **The `localized-date` component's other surfaces.** The round added
  `dir="ltr"` to it, so a date reads day-first in Arabic everywhere it is
  used — the shared data table (the Orders list's *Created at* column) and
  four detail pages included. That is a CROSS-SURFACE change, declared
  here: it matches what `Intl` produces for `ar-EG`, and the Orders e2e
  (19/19) still passes with it.
- **The seed data and the database.** Nothing was written; the only
  writes in the repository are the evidence PNGs and the JSON reports.
- **The four legacy ApexCharts components** (`category-chart`,
  `revenue-breakdown-chart`, `status-chart`, `orders-status-chart`) were
  not deleted — two of them are still used by `dashboard-overview`. Their
  money and their axes were wired to the shared formatters so that the
  "one formatter" rule holds for them too.

---

## 5. What I would test by hand, per cell

The matrix is captured (`evidence/dashboard-r2/<lang>-<theme>/`), but these
are the things a machine cannot judge:

**Every cell (375 / 768 / 1024 / 1440 / 1920 × light / dark × en / ar)**

1. The **Arabic summary line** under the revenue chart: the amount comes
   first in each figure ("1,176.25 ج.م"), and the date in the brackets
   reads day-first, left to right, as "20 أكتوبر 2026" — the same order
   `Intl` gives for `ar-EG`, and the same order the EN line has
   ("20 Oct 2026").
2. The **donut centre** in dark mode: "الإيرادات / 20.8K ج.م" must be
   clearly readable against the card, and must not touch the ring.
3. The **status donut** in dark mode: Delivered (muted green), Processing
   (muted blue), Shipped (violet). None of them may read as the teal or
   the olive of the origin donut next to it.
4. The **legend**: one column; the dot, the name, the value and the
   percentage line up; the rows are in the ring's order.
5. The **KPI row**: the four values sit on one line; the labels have the
   same padding; only "New customers" carries a "New" badge — the other
   three show an em dash, and hovering it says "No data in the previous
   period".
6. The **KPI money**: English "EGP 1,176.25", Arabic "1,176.25 ج.م" with
   the amount on the RIGHT (read first) and no full stop after the
   symbol.
7. The **bottom row**: the Low stock card is a centred "nothing to
   report" (not a line stuck at the top of an empty box) and the device
   list is one column with the full-width bars.

**Narrow cells (375 especially)**

8. The **tabs** wrap without pushing the card title out of the card, and
   the three revenue tabs still fit.
9. The **device list** and the **legend** do not overflow their cards (the
   matrix records 0 horizontal overflow in every cell, but the eye is
   better at this).
10. The **Arabic** wording in the narrow cards: the plural forms
    ("6 جلسات") must not be clipped.

**Dark mode only**

11. The **online-users dot** still pulses (and stops under
    `prefers-reduced-motion`).
12. The **focus ring** on the tab group and on the export button.

**By hand, with the data**

13. Change the range to 7 / 90 / 365 days and check that the scope badge
    and the numbers follow — and that the breakdown note is still there.
14. Open the Orders page: the count says "All orders" and its tooltip
    says it includes the cancelled, the pending and the refunded ones;
    the dashboard's card says "Paid orders" and its tooltip says it
    excludes them. The two numbers must reconcile (17 − 5 − 1 − 1 = 10).
15. Export the CSV from the Orders page and check that the order number
    column is the backend's `ORD-2026-000001` and that the money columns
    are formatted exactly like the screen.

---

## 6. The follow-up round (the newsletter page, the broadcasts, the page size)

**What was asked:** a newsletter page — export the addresses, see them as a
table like the other pages — the broadcasts page fixed, and then push
everything.

| Item | Status | Where | Evidence |
|---|---|---|---|
| The newsletter page (`/dashboard/newsletter`) | **done** | `src/app/features/newsletter/` | `e2e/newsletter-broadcast.spec.ts` — 4/4 |
| The export covers EVERY address (not the page) | **done** | `newsletter.service.ts` → `getEveryAddress()` | the e2e reads the downloaded CSV and compares its rows with the table |
| The address is never truncated | **done** | the email column is 260px | the e2e compares the cell's text with the rendered span |
| The count agrees in number ("1 address") | **done** | the app's plural family | the e2e matches `/\d+\s+address/` |
| The page says WHAT the list is | **done** | the help line under the header | read in the screenshots |
| The broadcasts: the count, the translated status, the audience, the DELETE, the export | **done** | `broadcast-list.component.{ts,html}` | the e2e + the delete test (it creates and removes its own broadcast) |
| **The page size: the API caps a page at 100** — a request above the cap is a 400, not a bigger page | **done** | `base-crud.service.ts`, `order.service.ts`, `product.service.ts` | the orders page loads again; `orders` 21/23 (was 11/23) |
| The Arabic UI carries no Latin string | **done** | the "Ctrl K" hint is LTR-only | `dashboard-round2` 10/10 |
| The e2e login reads the body at response time | **done** | `e2e/helpers/auth.ts` | no suite aborts on a false "requires an ADMIN" |

### What the follow-up found that was not asked for

**The orders page never loaded.** The orders list asked the API for
`size: 1000`; the API validates `size` on every dashboard list endpoint and
answers **400** for anything above **100** ("must be less than or equal to
100" — verified against orders, users, categories and broadcasts). The 400
sat inside the list's `forkJoin`, so the rows, the counts AND the KPIs
never arrived: the page stayed on "Loading..." and ten orders tests failed
with it. The size is now clamped to 100 in the base CRUD service and in the
product service, and a caller that needs the whole set **walks the pages**
(the orders KPI read, the newsletter export, the broadcasts export). The
clamp also unbreaks the journal form's preloader and the product wizard's
dropdowns, which asked for 200 rows and were getting an error instead of a
list.

### The verification of this round (production build, on a private port)

| Suite | Result |
|---|---|
| `dashboard-round2` | **10/10** |
| `dashboard-language` | **20/20** (every cell) |
| `dashboard-states` | 5/5 |
| `auth` | 10/10 |
| `newsletter-broadcast` | **4/4** |
| `orders` | 21/23 — the two failures are the other session's |
| `orders-states` | 10/11 — the same failure |

**The three remaining failures are all in the OTHER session's orders
redesign, and the app itself is right.** Both failing specs assert on the
payment-status STAT CARD (`[data-testid="orders-stat-card"]` → the second
card), and that card is gone: the redesign's cards are Revenue, Open
orders, Avg order value and Cancel rate. The second card is now "Open
orders", which is **0** for the `paymentStatus=FAILED` filter the test
uses — so the assertion "the count is greater than 0" fails on a correct
page. A probe of the same scenario (`evidence/probes/probe-filter-switch.mjs`)
delays the first orders request by 2.5s, switches the filter, and reads the
ROWS: the screen holds the four FAILED-payment orders and no PAID row, so
the "a fast filter switch never shows the data of an older request"
property **holds** — the specs point at a card the redesign replaced and
have to follow the new design. That is the other session's contract to
re-align, not a defect in the app.

### The environment, and how the round was verified

The repository is shared with a second session that takes **:4200** (the
only origin the backend's CORS allows), builds, commits, switches branches
and cleans the working tree — during this round it reset the working tree
twice, which cost one of my commits (recovered from the reflog and
re-applied). The suite therefore ran against a **private** static server
that also proxies the API server-side (`scripts/serve-with-proxy.mjs`), so
the CORS dance never happens and the port cannot be taken away:
`E2E_BASE_URL=http://localhost:4300`. The build is a real production build
(`ng build --output-path …`), not the dev server — the dev server's
first-paint latency made the fixed-wait tests fail for reasons that have
nothing to do with the app.
