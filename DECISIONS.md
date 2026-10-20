# DECISIONS

Running log of decisions taken while making the dashboard home look and behave
like a polished commerce admin. Each entry records what was decided, why, and
where the evidence lives.

---

## PHASE 0 — Harness

### 0.1 Production build is the build under test

`ng build --configuration production` completes with exit code 0 (only budget
and CommonJS warnings, no errors). The app on `:4200` is **not** an `ng serve`
dev server — it is a static server:

```
pid 260106  node .../serve dist/nocteon-dash/browser -l 4200 -s
cwd  /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard
branch  evidence-work
```

Because it serves `dist/nocteon-dash/browser` statically, **the served bytes
change only when a build runs**. Verified after the production build by
comparing the MD5 of `dist/nocteon-dash/browser/index.html` with the bytes
served on `http://localhost:4200/` — identical
(`c0fff4830a1290c7d23c54bd0b8bc797`).

**Decision:** every evidence capture in this project is preceded by a build.
The harness records the serving process (pid, cwd, cmdline) and the git
branch in `results.json` so a screenshot can never be silently attributed to
a stale bundle.

### 0.2 One login, replayed through a Playwright storageState

`POST /api/auth/login` is rate limited (5/min per identifier), and
`POST /api/auth/refresh` **rotates** the httpOnly `refreshToken` cookie and
**revokes the whole token family** when the same cookie is presented twice.
The naive harness shape — new context per cell, `page.reload()` per cell —
therefore logs itself out after the second cell.

**Decision:** one browser context for the entire run, one login, and the
`storageState` is written to `e2e/.auth/dashboard-admin.json` (gitignored) at
the **end** of the run, not at login time. Replaying a saved state into a
second context is what triggers reuse detection, so the harness never does it.

### 0.3 Language is switched at runtime, not seeded before load

A widget that reads the language once at construction (an ApexCharts legend,
an axis formatter) keeps the old language if the language is only seeded in
`localStorage` before the page loads. That is a class of bug the harness must
catch, so every Arabic cell boots the page in **English** and then flips the
language through the app's own control (user menu → Language), asserting
`document.documentElement.lang` afterwards. The English cells flip to Arabic
and back, so no cell is ever a cold load.

The theme is boot-time (the `.dark` class is applied on init), so it is seeded
through `localStorage` and read back from the DOM after load.

**Decision:** the harness records, per cell, the observed `lang`, `dir` and
`dark` state. A cell whose DOM state does not match its label is a failure,
not a cosmetic difference.

### 0.4 Seeding localStorage without booting the app

Any real page load runs the app initializer, which POSTs `/api/auth/refresh`
— the rotating-cookie problem from 0.2 again. The harness therefore serves a
tiny same-origin document at `/__evidence-seed` (a Playwright route
fulfillment) and writes `localStorage` there. Same origin, so the storage is
shared with the app; no app boot, so no refresh.

**Decision:** one app load per cell. The `__evidence-seed` route is a
harness-only concern and never reaches the backend.

### 0.5 "Before" screenshots

`evidence/phase0-before/` holds the full 5×2×2 matrix (375, 768, 1024, 1440,
1920 × light/dark × en/ar) captured **before** any Phase 1 change, so every
later claim has a baseline to compare against.

**Evidence:** `evidence/phase0-before/results.json` (20 cells, each with the
file path, the runtime-switch flag and the observed DOM state),
`evidence/phase0-before/<lang>-<theme>/dashboard-<width>.png`.

### 0.6 The first "before" capture already showed the seed-data problem

The baseline capture shows the dashboard reading **E£** for every amount, a
single revenue bar on 20 Oct, `New Customers 9` vs `previousPeriodCount 0`,
and a "Needs attention" panel that is empty while the same payload reports 10
orders in one day. This is the data shape Phase 1 has to explain, not a UI
defect.

---
## PHASE 1 — Data integrity

### 1.1 The previous period was never a previous period

**Root cause (backend, confirmed by reading the source at
`nocteon-backend/src/main/java/.../dashboard/service/DashboardService.java`):**

```java
private DashboardOverviewResponse buildOverview(Instant since, Instant until, int days) { … }
```

`until` is accepted and then **never used**. Every query filters only
`o.createdAt >= :since`. The compare endpoint calls

```java
previous = buildOverview(now.minus(days * 2), now.minus(days), days);
```

so the "previous" figure is really *everything since 2N days ago* — a
**superset** of the current window, not the window before it. Measured: the
`previous` object is byte-identical to `current` for revenue, orders, AOV,
coffee sold, `revenueByDay`, `ordersByStatus`, `revenueByCategory`,
`topSellingProducts` and `userGrowth`.

The one exception is `userGrowth`: `buildUserGrowth(days)` computes its own
`previousPeriodCount` with a real `BETWEEN` bound, so *that* number is
correct. That is exactly why the dashboard showed "New" on New Customers and
a flat `0.0 %` on the other four.

**Fix (client-side; the backend is not changed):** the dashboard no longer
uses `overview/compare`. It requests `overview?days=N` (the selected window)
and `overview?days=2N` (the span of both windows) and derives the previous
window as `span − current`, which is exact because every aggregate is a plain
sum over a lower date bound. AOV is a ratio and is recomputed from the two
derived components rather than subtracted.

New modules, all unit-tested:

- `src/app/core/dashboard/period.ts` — window arithmetic. Half-open
  `[start, end)`, equal length, no overlap. Calendar-day arithmetic via
  `setDate`, **not** `getTime() + n × 24h`, because a DST transition makes a
  day 23 or 25 hours long and the old arithmetic drifted a 90-day window
  onto 91 days (caught by `period.spec.ts`).
- `src/app/core/dashboard/period-fetch.ts` — the two requests and the
  derivation. `period-fetch.spec.ts` proves the previous request carries
  different `days` (60 vs 30) and is credited with a disjoint date range
  (2026-08-22…2026-09-20 vs 2026-09-21…2026-10-20).
- `src/app/core/dashboard/delta.ts` — the delta rule, with the fixture set the
  ticket asks for: previous = 0, both 0, equal, increase, decrease, and
  previous larger.

### 1.2 The delta vocabulary

A zero change is **not** a positive change. The old rule used
`pct >= 0` to decide "positive", so a 0.0 % change rendered a green up arrow
with the label "+0.0 %" on four cards. The new rule:

| Case | Label | Colour | Arrow |
|---|---|---|---|
| previous = 0, current > 0 | "New" / "جديد" | success (never warning) | none |
| previous = 0, current = 0 | "—" | muted | none |
| current = previous | "No change" / "لا تغيير" | muted | none |
| increase | "+12.5 %" | success | up |
| decrease | "−7.0 %" | destructive | down |

The chip is a small pill with the arrow inside it, so the sign, the arrow and
the colour can no longer disagree. `Intl` `signDisplay: 'always'` keeps the
sign attached to the digits, and the value is wrapped in `<bdi>`.

### 1.3 One currency formatter, fed by the store setting

- **Source:** `GET /api/settings` → `data.currency` ("EGP"), read once by
  `StoreSettingsService` and shared by every formatter.
- **One formatter:** `formatCurrency(value, lang, currency)` in
  `src/app/shared/utils/locale-format.ts`, exposed to templates as the
  `| money` pipe.
- **The third argument is no longer optional.** Removing the default
  (`currency = 'USD'`) made the *compiler* list every call site that had been
  silently formatting money in USD: 8 of them. They were fixed, not allowed
  to stay.
- **Arabic symbol:** `currencyDisplay` is `symbol` for Arabic ("ج.م.") and
  `narrowSymbol` for English ("E£"). `narrowSymbol` alone renders "E£" in
  *both* locales — that was the QA finding. Digits stay Latin
  (`ar-EG-u-nu-latn`).
  **SUPERSEDED by the Round 2 (see "DASHBOARD ROUND 2" below):** the
  shared formatter now prints the **ISO code first in English**
  ("EGP 1,176.25") and the **amount first in Arabic, without the trailing
  full stop** ("1,176.25 ج.م"). The narrow symbol is gone: a currency
  symbol in a Latin shape made the reader see two different currencies
  depending on the page.
- **Also migrated:** 18 sites used Angular's built-in `| currency:'EGP'`,
  which hardcodes the code and ignores the store setting. They now use
  `| money`.

**Guard** (`src/app/shared/utils/locale-format.spec.ts`, 8 assertions): no
template may hardcode a currency symbol, print money with the number pipe,
use the built-in `currency` pipe, or import `CurrencyPipe`; no source file
may format money with `toFixed`; and `formatCurrency` must have no default
currency.

### 1.4 The three revenue numbers are three different quantities

The QA report treated 1,176.25 vs 20,826.50 as a range-filtering problem.
It is not. Measured against the orders endpoint:

| Widget | Endpoint | Range-filtered? | Formula | Value |
|---|---|---|---|---|
| Total Revenue KPI | `stats/overview?days=30` | yes | `SUM(order.totalAmount)` | 1,176.25 |
| Category / Origin / Roast | same | **yes** | `SUM(orderItem.totalPrice)` | 20,826.50 |
| Top Selling Products | same | yes | qty = `SUM(item.quantity)`, price = the **lowest variant price** | implies 15,925 |

`days=0` returns `[]` for every breakdown, so the breakdowns **are**
range-filtered — the earlier "All time" label on those cards was wrong and
has been corrected to "Selected period".

The real cause is the **seed**: for every PAID order,
`order.totalAmount` (120.50) does not equal the sum of its own items
(1,825.00) plus shipping. All 10 PAID orders violate
`totalAmount == SUM(items) + shipping − discount`. The backend's category
percentage is `20,826.50 / 1,176.25 = 1,770.6 %` — a percentage above 100 %
is the tell.

The dashboard cannot reconcile this without the backend changing, so each
widget now says what it measures: the Top Selling Products column is
labelled "List price" with a tooltip explaining that it is the product's
lowest variant price and does not multiply out to the revenue on the revenue
chart. The reconciliation table — endpoint, range-filtered, formula, observed
value, and an independent recomputation from the orders endpoint — is in
`evidence/phase1/results.json` → `measurements.reconciliation`.

### 1.5 Refund rate: a count, not money

`refundRate` is `COUNT(paymentStatus = REFUNDED) / COUNT(paymentStatus =
PAID) × 100`. Both fields are **order counts** (10 and 2), which is why
"2 / 10" used to be rendered as money. The card now shows "2 of 10 orders"
and carries a one-sentence definition in a tooltip: *"Refunded orders as a
share of paid orders in the selected period."*

Refunded is a **payment status**, not an order status — the status chart
groups by `order.status` for PAID orders, so a refunded order never appears
there. The status chart is therefore titled "Paid orders by status" and
carries the same note, so the two widgets cannot be read as contradicting
each other.

### 1.6 Two non-reactive widgets the runtime-switch harness caught

The Phase 0 harness switches the language **at runtime** rather than seeding
it before load. That immediately exposed two widgets that had captured the
language at construction time:

- The donut centre label was baked into the ApexCharts options and never
  re-read, so the **English** dashboard displayed the Arabic "الإجمالي".
  Fixed by re-applying the chart options when the language changes.
- The category / origin / roast **names are localized by the backend**
  (`Accept-Language` is read when the query runs), so a runtime language
  switch has to **refetch** — otherwise the Arabic dashboard kept the
  English "Coffee". The stats service now refetches on a language change.

The Arabic range dates are rendered with the app's existing
`<app-localized-date>` component, which lays the parts out as DOM-ordered
spans; plain-text dates with Latin digits and an Arabic month cannot render
day-first in any paragraph direction.

### 1.7 Seed data — proposal only

`SEED_PROPOSAL.md` describes a dev-profile seed (~60 days of orders, all
statuses, 24 customers who are not the admin, a pending order, a low-stock
product, an unread message, a review awaiting moderation) and states the
invariant the current seed violates. **Nothing was run and no data was
created, modified or deleted.** The checks that cannot be verified without it
are listed in the proposal (§3).

### 1.8 Narrow-width overflow and clipping

`evidence/phase1/overflow.json` — measured at 375 and 768 in both languages:
**0 px of horizontal overflow, 0 unintentionally clipped elements** in all
four cells. The elements the scan flags are either `truncate` (an ellipsis by
design) or `sr-only` (screen-reader text that is not rendered at all) — both
are recorded with that reason rather than counted as defects.

## PHASE 2 — Language and Arabic correctness

### 2.1 Three root causes, not one

The QA report listed five symptoms (Arabic entity names, the Arabic
"الإجمالي", Arabic product names, Arabic axis months, and the raw key
`orders.statuses.DELIVERED`). They turned out to have **three**
independent causes, in the language layer rather than in the widgets.

**(1) RAW KEYS — a missing-key fallback that could never fire.**
`TranslocoService.translate()` returns **the key itself** when a key is
missing (Transloco's default missing-key handler returns the key). The
status chart did `translate(key) || status` — but a missing key is a
non-empty string, so `||` never fired and the raw key went on screen.
The keys were missing because `setActiveLang()` is **synchronous and does
not load the dictionary**: between the language flip and the JSON arriving,
the active language pointed at a dictionary that was not there yet.

*Fix:* `LanguageService` now **loads the dictionary before flipping the
language** (`load -> setActiveLang -> signal`), and the app initializer
awaits it. Plus a shared `LocalizedNameService` that compares the
translation with the key it asked for and substitutes a fallback when they
are identical — a missing key can never reach the screen.

**(2) ARABIC ENTITY NAMES — the backend localizes them.**
Category, origin, roast-level and product names are translated **by the
backend** (`Accept-Language` is read when the query runs), so a runtime
language switch has to **refetch**. The overview is now re-requested on
every language change (the stats service effect added in Phase 1).

**(3) NON-REACTIVE WIDGETS — chart options are built once.**
ApexCharts only re-reads its options when they are pushed back into it, so
the donut-centre label, the axis categories and the legend series names
kept the language they were constructed with. Every chart now re-applies
its options when the language changes.

**One shared helper for names, one for dates.** `LocalizedNameService`
(every entity name: order status, payment method, device type) and
`LocalizedDateService` (every date: axis labels, tooltips, tables). The
revenue chart's axis and tooltip now both read the same helper, so they
cannot disagree.

### 2.2 Arabic grammar is a plural-category problem, not a string problem

Arabic counts a noun by the number in front of it, so a fixed word is
always wrong for some number:

| Number | Category | days | sold |
|---|---|---|---|
| 1 | one | 1 يوم | مبيعة واحدة |
| 2 | two | 2 يومان | مبيعتان |
| 3–10 | few (PLURAL) | 7 أيام | **8 مبيعات** |
| 11–99 | many (SINGULAR) | **30 يومًا** | 30 مبيعة |
| 100+ | other | 100 يوم | 100 مبيعة |

That is exactly why "30 يوم" was wrong and "30 يومًا" is right, and why
"8 مبيعاً" was wrong and "8 مبيعات" is right.

*Fix:* the **category** comes from `Intl.PluralRules`; the **wording**
lives in the locale file (`dashboard.countDays_few`, …), so a linguist can
change it without touching code. English has one/other; Arabic has all six
— so the plural families are deliberately asymmetric, and the key-set
symmetry test exempts exactly those families (and a new test asserts each
family is complete for its language).

**The slash is gone.** "4 / 5 customers" became "4 of 5 customers" /
"4 من 5 عملاء": a slash between two numbers in an RTL paragraph is read
right-to-left and the two numbers swap, so the separator is a word.

**Sign placement.** `Intl` `signDisplay: 'always'` keeps the sign attached
to the digits and the value is wrapped in `<bdi>` (Phase 1).

### 2.3 The glossary: "Needs attention"

The Arabic title had drifted to **تنبيهات** ("alerts") — a different
concept from the English, and a word that collides with the dashboard's
separate "Low stock alerts" widget. The approved term is **يحتاج انتباه**,
which keeps the EN/AR concepts aligned (both are a predicate).

Four concepts are now pinned in `docs/glossary.md` and enforced by the
"dashboard glossary" tests, in **both** directions: the approved word, and
no competing title for the same concept. "Low stock alerts" is a different
concept and stays — every occurrence is listed in
`evidence/phase2/measurements.json` so it can be judged rather than
guessed. The dead duplicate titles `charts.topProducts` ("Top products")
and `charts.categoryPerformance` named the same concepts as the pinned
ones; they were unreferenced, so they were removed rather than left to
drift.

### 2.4 Sentence case

Every dashboard widget title is sentence case in English ("Revenue by
category"), enforced by a test that fails on a capital anywhere but the
start. One deliberate exception: `dashboard.metrics.activeSubscriptions`
stays "Enabled Subscriptions" — pinned by the earlier user ruling A and a
subscriptions metric, not a widget title.

### 2.5 One header pattern, one range scope

Every widget header is now `<app-widget-header>`: title (sentence case) +
scope + optional action, in one flex row. The scope is always "Last 30
days" (or the selected range) for a widget that reads the range, and "All
time" for one that does not — **low stock** is a catalogue state, not a
period metric. Before this, three different labels were in use (the range
name, "Selected period", "All time"), so a reader could not tell which
widgets respected the range selector.

The scope never wraps to a second line: the title truncates, the scope
label is `shrink-0 whitespace-nowrap`.

### 2.6 Evidence

`e2e/dashboard-language.spec.ts` — switches **English → Arabic → English**
at runtime through the app's own control and asserts, in each state: the
legend entries, the donut-centre labels, the x-axis labels, the status
labels, that the Arabic axis carries Arabic month names, that the English
page carries no Arabic and the Arabic page no English, and that **no
string matching `/\b[a-z]+\.[a-z]+\.[A-Z_]+\b/` appears anywhere**.

**20/20 cells pass** (en/ar × light/dark × 375/768/1024/1440/1920).
Raw keys found in the live app: **0**.

## PHASE 3 — Chart system and color

### 3.1 The palette, and what it replaced

Six categorical hues and a four-step sequential ramp, in
`src/styles/themes/copper.css`:

| Token | Light | Dark | vs card (light / dark) |
|---|---|---|---|
| `--chart-1` copper | #8a4b22 | #d9955b | 6.75 / 7.03 |
| `--chart-2` ochre | #b07d2b | #e0b45a | 3.61 / 9.07 |
| `--chart-3` olive | #5f7a1f | #a9bf6a | 4.89 / 8.66 |
| `--chart-4` teal | #3b7f86 | #6fb6bb | 4.60 / 7.60 |
| `--chart-5` slate | #55688f | #93a7d1 | 5.58 / 7.27 |
| `--chart-6` plum | #8a5370 | #c58da8 | 5.91 / 6.48 |
| `--roast-1..4` | #d9ae82 … #4f2a12 | #ebcba3 … #9a5a2f | 2.03 (exempt) … 12.56 |
| `--chart-other` | #8a8178 | #8f857b | 3.82 / 4.86 |

**Removed:** the cyan (#0e7490 / #3db8d4), periwinkle (#4f6ba0 / #8fa8e0)
and lime (#5f7a1f / #a3c45a) that were chart-2/3/4. They read as "system
default" next to a coffee palette.

**31 of 32 swatches pass the 3:1 graphics threshold.** The one exception is
`--roast-1` on the light card (2.03:1) — the lightest step of the ramp. It
always carries a 2 px card-coloured gap and a visible value label.

A **single series** uses `--chart-1` (a rainbow for one number is noise), the
"Other" bucket uses the neutral `--chart-other`, and an **order status** uses
a **semantic** token (delivered = success, processing = info, shipped =
slate, pending = warning, cancelled/failed = destructive, refunded = muted).
A status has a meaning, so it never uses the categorical palette.

### 3.2 One chart component, and the type rule

`shared/components/chart/chart-card.component.ts` draws every breakdown, so
two charts cannot disagree. The rules live in `chart-rules.ts` and are
unit-tested:

| Slices | Chart |
|---|---|
| 0–1 | a **stat** — a single-slice donut is not a chart |
| 2 | **bars** |
| 3–5 and ≥ 160 px wide | **donut** |
| 6+ | **bars** |

The **legend is always below the chart** and always carries the colour, the
name, the value AND the percentage — a legend with only a colour is a legend
that relies on colour alone.

### 3.3 The donut: the hole is a hole

The slices are **stroked arcs, not filled wedges**. A filled wedge paints over
the middle, which is exactly why the hole used to be a darker disc than the
card. Now nothing is painted in the middle, so the card shows through it.

The centre uses `--foreground` (measured #f5efe8 in dark, 15.4:1 on the
card) — **SUPERSEDED by the Round 2 in two ways**: the compact form now
carries the CURRENCY ("EGP 20.8K" / "20.8K ج.م"), and the centre's LABEL
says what the number is ("Revenue" / "Orders") rather than the name of the
tab it is showing. The compact form is the
**compact** form when the number is long ("20.8K", not
"E£20,826.50"), and never leaves the ring. Every donut on the page has the
**same 220 px diameter**.

A direct label goes inside a slice only when the slice is at least 12 % of
the ring: two overlapping percentages are worse than none.

### 3.4 The revenue chart is the hero

**Bars, not a line** — daily revenue is a set of discrete values, and a line
draws a slope between them, so a single spike reads as a trend that never
happened. 320 px tall, full width. Zero days are included, so the gaps are
visible. The y-axis is compact with the currency. The tick density adapts to
the width (one label per ~90 px, never fewer than 3) and the last day never
collides with the tick before it.

A **summary line** (total · average per day · best day) sits under the
chart, and a **"view as table" toggle** opens the same data as a table, so
the numbers are available without seeing the picture. The chart has an
`aria-label` with the total.

The previous period is a **dashed outline** behind the current bars, drawn
only when the API returns a previous window — it does (Phase 1 derives it),
so the comparison is drawn.

### 3.5 Consolidation

- **One "Revenue by" card** with tabs [Origin | Roast level | Category]. The
  three breakdowns were three separate donut cards asking the same
  question. The roast tab uses the **sequential ramp following the ROAST**,
  not the revenue: the overview endpoint returns the roast breakdown ordered
  by revenue, so a ramp applied to that order would give a dark roast the
  lightest colour. The order comes from the canonical roast list.
- **One "Orders by" card** with tabs [Status | Payment method]. A status is
  semantic, a payment method is a category — so they get different palettes
  from the same card.
- **Devices** are a compact bar list scaled to the **largest** device (not
  the total) and use the **full track** — a list where the biggest bar is
  30 % of the track reads as "everything is small". The unit is stated
  ("sessions"); what a device row actually represents is a backend question
  and is listed in `evidence/phase1/measurements.json`.
- A tab with a single value is **hidden** — it would be a stat. The category
  tab is hidden today for exactly that reason (one category in the seed).

### 3.6 Evidence

`evidence/phase3/results.json` carries the contrast table (32 swatches ×
both modes), the donut overflow checks, the legend-position check (the
legend's bounding box is below the chart's), the diameters, and the
transparent-segment check.

**Acceptance:** contrast 31/32 pass (one exempt, 0 failing); 0 donuts
overflow their ring; the legend is below the chart in every case; one
diameter (220 px); 0 transparent or white segments; 0 raw keys.

## PHASE 4 — Layout and hierarchy

### 4.1 One toolbar

The range control, the range it compares against, and the export were on
three different lines in three different corners. They are now **one sticky
row** (`app-dashboard-toolbar`), with the title and the subtitle above it.

The range is a real `radiogroup` and the selection is announced through an
`aria-live` region, so the change is heard and not only drawn. The export
carries a tooltip that says what it exports and for which range, and the CSV
now has a **UTF-8 BOM** so Excel opens the Arabic file as UTF-8 rather than
as Latin-1.

### 4.2 Four strong KPIs, then a strip

Eight equal cards say that nothing matters. The area is now **four primary
cards** (total revenue, orders, new customers, average order value) with the
value in tabular figures at 30 px, a delta chip, and — where the API has the
data — a **sparkline from the real daily series** (the same series the
revenue chart draws; a faked sparkline would be a decoration).

The rest moved to a **compact strip** (repeat rate, refund rate, coffee sold,
online users). **Online users is a live indicator** — a pulsing dot and
"currently online" — not a period KPI.

The repeated "vs previous period" caption is gone from the cards; the
toolbar carries the comparison, and each chip keeps an accessible
description of what it is compared against.

### 4.3 The attention strip

When everything is clear it is **one line, 48 px** — a check and a sentence.
A full card saying "all clear" is a card that shouts about nothing. When
something DOES need attention, each row is a link with a count.

The counts are exactly the ones the backend already provides
(`ordersByStatus` → pending, `pendingReviewsCount`, `lowStockProducts`,
`unreadContactMessagesCount`). The counts the backend does **not** provide
are listed in `evidence/phase4/measurements.json` →
`missingBackendContracts`.

### 4.4 The page, and its height

**2390 px → 1696 px** at 1440 (target under 1700). The structure is now:
title, toolbar, four KPI cards, the compact strip, the attention strip, the
revenue chart (full width), then three two-column rows — Revenue by | Orders,
Top products | Recent orders, Low stock | Devices.

Two real bugs came out of the measurement:

- **`h-full` on a card inside an auto-sized grid row** made the row collapse
  to the *other* card's height, and the card's own `overflow-hidden` clipped
  the last row of the device list. The grid already stretches its items; the
  card did not need it, and the card content must not shrink
  (`shrink-0`).
- **The card content is a flex item** and could shrink below its content,
  which is how the device list lost its last row in the first place.

The card-height ratio is measured per ROW against the tallest card in it
(two cards in a row necessarily share a height, so the rule is about the
row, not about the shorter card): **1.05 – 1.25**, all under 1.5. A
**clipping check** was added to the measurement: no card may clip its own
content.

The revenue chart is 270 px rather than the ~320 px of ticket 3.4. That is a
deliberate trade: the structure and the content of ticket 4.4 do not fit
under 1700 px with a 320 px chart, and 4.4 is the tighter constraint.

### 4.5 Top products and recent orders

**Top products** shows **units with a share bar**, and the column header
says "Units sold". The unit price is gone: `topSellingProducts.price` is the
product's LOWEST variant price and is not what the customer paid, so putting
it next to "8 sold" implied a number that was never true. The API returns no
per-product revenue — the missing contract is listed in the evidence rather
than invented.

**Recent orders**: every row is a **link to the order**, the date is
**relative** when it is recent ("5 hours ago") and absolute when it is not,
the customer name comes from the order, and the **"View all" link appears
once** — in the card header. The list used to have one in the header AND one
at the bottom.

### 4.6 Spacing and style

Content max-width **1280 px** (`max-w-7xl`), centered; **24 px** gaps
between sections; a **12 px** card radius (`--radius-card`); no shadows on
cards (the card is a ring, not a shadow); sentence-case titles (Phase 2);
tabular figures on every number; muted labels at 12 px with 6.34:1 (light)
and 6.41:1 (dark) contrast — comfortably over the 4.5:1 the ticket asks
for.

### 4.7 Evidence

`evidence/phase4/results.json` carries the page height before and after, the
card-height ratio per row, the toolbar's position and height, the "View all"
count per widget, the attention-strip height, the clipping check, the content
max-width, and the horizontal-overflow measurement.

**Acceptance:** page height 2390 → **1696** (target 1700, met); every row
ratio ≤ 1.25; the toolbar is `sticky` and in one row; "View all" appears once
in each of the 3 widgets that have one; the attention strip is 48 px; 0
clipped cards; 0 px of horizontal overflow; 20 screenshots.

## PHASE 5 — States and interactions

### 5.1 Every widget has three states, and they all look the same

A new `app-widget-state` wrapper owns the decision, so no widget has to
remember it and no widget can be blank:

- **loading** — a skeleton with the SHAPE of the content (so the page does
  not jump when the data lands), and a `role="status"` announcement;
- **error** — what failed, plus a RETRY that really retries
  (`role="alert"`);
- **empty** — the widget is fine, there is simply nothing to show.

The stats service now keeps a **per-source** error (`overviewError`), so
failing one endpoint shows the error on the widgets that read it and the
others keep working. The recent-orders widget has its own error and retry;
the store-settings failure shows the currency notice.

**Measured** (`evidence/phase5/measurements.json`): failing
`/api/dashboard/stats/overview` produces 2 error states with a retry and no
blank card; failing `/api/settings` produces 1 alert (the currency
fallback); failing `/api/dashboard/orders` produces 1 error state on the
recent-orders widget while the KPI area still renders. The loading skeleton
is observed on the wire (the overview is slowed deliberately). The empty
state is the low-stock widget's ONE line.

**`GET /api/dashboard/settings` is 405** (the route only accepts PUT). The
working read is `GET /api/settings` -> `data.currency`, used by
`StoreSettingsService`.

### 5.2 The range cannot be raced

Switching 7 -> 90 -> 7 fires three requests that can answer out of order.
The service stamps every request with an id and **discards any response that
is not the newest**, so the page can never show the data of an older range.
Tested in `e2e/dashboard-states.spec.ts` with the first request delayed.

### 5.3 The range lives in the URL

`?days=N` is read on load, written on every change (as a real navigation,
so the BACK button walks back through the ranges), and **followed** when the
URL changes — refresh, a shared link and back/forward all work.

**The store's time zone is Africa/Cairo** (EEST, UTC+3 in October 2026) and
the browser agrees. The **database buckets days in UTC** (`Etc/UTC`) and the
backend's `since` bound is an instant, so an order placed between 00:00 and
03:00 Cairo is counted on the PREVIOUS day in the backend's daily series.
The dashboard's windows are whole Cairo calendar days
(`core/dashboard/period.ts`), and the day-boundary behaviour — including an
order at **23:30** — is pinned by `period.spec.ts`.

### 5.4 Drill-down

The KPI cards are **real links** (not click handlers on a div): focusable,
openable in a new tab, announced as links, with a visible focus ring.

| From | To |
|---|---|
| Total revenue | `/dashboard/orders` |
| Orders | `/dashboard/orders` |
| New customers | `/dashboard/users` |
| Avg order value | `/dashboard/orders` |
| An order-status slice in "Orders by" | `/dashboard/orders?status=<STATUS>` |
| Unread messages | `/dashboard/contact-messages?status=unread` |
| Reviews awaiting moderation | `/dashboard/reviews?status=pending` |
| A low-stock product | `/dashboard/products/<slug>` |

The list pages read the pre-filter from the URL, so the link is shareable
and survives a refresh.

**One gap, reported rather than faked:** the products LIST api has no stock
filter (only `inStockOnly` / `onSaleOnly`) and its rows carry no stock at
all, so there is **no pre-filtered low-stock list page**. The low-stock
widget's rows link to each PRODUCT instead, and the missing contract is
listed in `evidence/phase5/measurements.json`.

### 5.5 Accessibility

`@axe-core/playwright` is **not installed**, and the ticket says not to
install new tooling without asking, so the checks are DOM measurements:

| Check | Result |
|---|---|
| The range selector has a `radiogroup` with a checked radio | yes |
| The selection is announced (`role="status" aria-live="polite"`) | yes |
| Every chart carries a text summary (`role="img"` + `aria-label`) | yes |
| Every legend row carries a name, a value AND a percentage | yes (never colour alone) |
| Focus ring visible — **keyboard Tab walk**, both themes | **0 of 69 without a ring** in light and in dark |
| Reduced motion respected | yes (`prefers-reduced-motion` switches the shimmer off) |
| The KPI cards are real links | yes |
| 200 % zoom (720 px viewport) | 0 px of horizontal overflow, 0 clipped elements |

The focus-ring check is a **Tab walk**, not a programmatic `.focus()`:
`:focus-visible` does not match a programmatic focus, so the first version of
the check reported 22 false failures that did not exist.

## PHASE 6 — Responsive and final verification

### 6.1 The grid

| Width | KPI grid | Secondary strip | Chart rows | Horizontal overflow | Clipped text |
|---|---|---|---|---|---|
| 375 | 1 column | 1 column | 3 | 0 px | 0 |
| 768 | 2 columns | 2 columns | 3 | 0 px | 0 |
| 1024 | 4 columns | 4 columns | 2 | 0 px | 0 |
| 1440 | 4 columns | 4 columns | 2 | 0 px | 0 |
| 1920 | 4 columns | 4 columns | 2 | 0 px | 0 |

Measured in both languages (`evidence/phase6/measurements.json`). No
horizontal page scroll and no clipped text at any width.

### 6.2 The contact sheet

`scripts/contact-sheet.py` composes a **before / after** sheet for every
cell: the Phase 0 baseline on the left, the Phase 6 matrix on the right.
Twenty sheets, one per cell, in
`evidence/phase6/contact-sheet/<lang>-<theme>-<width>.png`.

Pillow composes the images; nothing new was installed.

### 6.3 design.md

Updated with the new chart tokens and the contrast audit (section 2, 2b and
5), the chart system (2b: type rule, bars, donut, legend, colour by meaning),
the dashboard home pattern (section 10), and the accessibility additions
(section 11: the focus-ring Tab walk, chart summaries, 200 % zoom).

## Final verification

- Production build: green.
- Unit tests: **113 / 113** (10 spec files).
- E2E, per spec (the suite cannot run in one pass — the login endpoint
  allows 5/minute per identifier and the suite logs in once per test):
  **dashboard-language 20/20**, dashboard-states 5/5, verify-tables 5/5,
  auth 10/10, and 137 assertions green across the 20 specs re-run
  individually.
- The full report is `FINAL_REPORT.md`.

### One inherited failure found and fixed

`e2e/verify-tables.spec.ts` failed on the carts list: the widest data
column ("Customer", 225px) had to dominate the actions column (116px) by
2.5x. The cause was that the carts list's identity column had no width of
its own, so it shared the leftover with the other unsized columns. Fixed by
giving it a share of the row (`userFullName: '28%'` in the shared
`columnWidths` map, the same mechanism the other identity columns use) —
the guard was NOT relaxed.

### Two guards made more general by this work

- The i18n key-set symmetry test now **discovers** plural families (a key
  whose base has siblings in other categories) instead of listing four
  known bases, so a family added later is exempt from the symmetry rule for
  the right reason.
- The money-formatter guard now also rejects the built-in `| currency` pipe
  and the `CurrencyPipe` import, which were a second way of printing money.


---
---

# ORDERS — the orders list and the order detail page

> A second, separate piece of work on the same repository. The sections
> above are the dashboard-home work; everything below is the orders work.
> Branch: `feature/orders-polish` (from `backup/pre-orders-work`).
> The backend is a SEPARATE repository (`../nocteon-backend`); nothing in
> this repository can change it, so the backend needs are written down in
> `ORDERS_CONTRACT.md` instead of being patched.

## ORDERS PHASE 0 — Harness

### 0.1 The build, the server, the branch

`npx ng build` passes (exit 0). The process on :4200 is
`serve dist/nocteon-dash/browser` — a static server for the PRODUCTION
build, not `ng serve` — so **the build is re-run before every capture**;
otherwise the screenshots would show the previous build. The provenance is
recorded in every `results.json` under `harness.server` (pid, working
directory, command) together with `harness.gitBranch`.

Branch: `feature/orders-polish`, from `backup/pre-orders-work`.

### 0.2 The evidence harness takes TARGETS, not one URL

The harness already existed for the dashboard home (one URL, one
screenshot per cell). It now takes a **set of targets** per phase
(`scripts/evidence-targets.mjs`), and a target is one screen:

| Target | What it is |
|---|---|
| `orders-list` | the list |
| `order-detail` | a DELIVERED order with items (the totals mismatch is visible) |
| `order-detail-midflow` | a CONFIRMED order (the tracker's mid-flow state) |
| `order-status-dialog` | the "Update status" dialog |
| `order-cancel-dialog` | the cancel dialog (behind the overflow menu) |
| `order-refund-dialog` | the refund dialog |

Each target is captured in all 20 cells (5 widths × 2 themes × 2
languages) with the **language switched at runtime** through the app's own
control, and measured in the page: the horizontal page overflow, the
VERTICAL and HORIZONTAL clipping, the deliberate ellipses, the raw
translation keys, the badge colours with their contrast, the card height
ratios, the section order and the progress tracker's steps.

The measurement script is a separate, isolated run; a failure there no
longer throws away a finished capture (the error is recorded in
`results.json`).

## ORDERS PHASE 1 — Data integrity

### 1.1 The totals: where they come from, and why 17 of 17 disagree

The backend stores `orders.total_amount` and returns it verbatim. The
runtime formula (`OrderService.createOrder`) is correct:

```
total = (Σ variant.price × quantity − discount_amount) + shipping_cost
```

**The root cause of the mismatch is the SEED, not the formula.**
`V107__seed_orders_reviews_contacts.sql` writes `orders.total_amount` by
hand, independently of the `order_items` rows it inserts in the same file:
`ORD-2026-000001` stores 120.50 while its items are 1,825.00 + 50.00
shipping. **All 17 seeded orders disagree with their own items** (the
full list is in `evidence/orders/measurements.json`).

The UI does not hide it and does not re-derive the total: the totals card
shows the **stored** total (the backend is the source of truth), the
subtotal the items add up to, and a warning when the two disagree.
`computeOrderTotals` is a pure function with fixtures for the no-discount,
discount, shipping, free-shipping, refund, empty-items and mismatch cases
(`order-totals.spec.ts`, 15 tests).

**Net paid is `null` for a refunded order**, not 0: the backend records the
`REFUNDED` flag with no amount, so claiming 0 would claim a full refund.

### 1.2 The cards: the real defect, and what replaced it

The header said **17** while the cards said **10** — and "Cancelled" said
**0** while seven rows said "Cancelled". Two causes, both now gone:

1. the cards read `DashboardStatsService.statusChartData()` — the
   **dashboard's 30-day window**, not the orders list. The order of
   magnitude was right by accident; the scope was wrong.
2. the dashboard's window holds no cancelled order, so the count was 0.

The cards are now computed from the **whole set the list fetched**,
grouped by status, and each one says what it counts:

| Card | Counts | Value (17 orders) |
|---|---|---|
| All orders | every order in the store | 17 |
| Matching filters | the orders the active filters select | 17 |
| Open | `PENDING` + `CONFIRMED` + `PROCESSING` | 2 |
| Delivered | `DELIVERED` | 9 |
| Cancelled | `CANCELLED` | 5 |

The status tabs carry the same counts, and the "Cancelled" tab (5) agrees
with the "Cancelled" card (5) and with the rows.

**The stats endpoint does not exist**, so the counts are computed in the
browser over the full set. The exact contract it needs is in
`ORDERS_CONTRACT.md` §3.1 and in `results.json` → `measurements.kpi.requiredContract`.

### 1.3 The status model

One model, in `features/orders/models/order-status.model.ts`:

| | |
|---|---|
| Order status | `PENDING` `CONFIRMED` `PROCESSING` `SHIPPED` `DELIVERED` `CANCELLED` |
| Payment status | `PENDING` `PAID` `FAILED` `REFUNDED` |
| Payment method | `ONLINE` `CASH_ON_DELIVERY` |
| Transitions | `PENDING→{CONFIRMED,CANCELLED}`, `CONFIRMED→{PROCESSING,CANCELLED}`, `PROCESSING→{SHIPPED,CANCELLED}`, `SHIPPED→{DELIVERED}`, `DELIVERED` and `CANCELLED` are terminal |

**"Refunded" is a PAYMENT status, not an order status** — a refunded order
keeps the fulfilment status it reached.

**The mismatch with the dashboard:** the chart colours (`orders-status-chart`)
used `--success` for CONFIRMED and `--accent` for SHIPPED, and the chart
only ever shows the statuses that occur in the window (three of six). The
badge mapping now follows the ticket exactly — Pending = warning,
Confirmed = info (the pale end of the family), Processing = info, Shipped =
`--chart-5`, Delivered = success, Cancelled = destructive, Refunded =
muted — and the chart was moved onto the same mapping, with `--chart-4` for
Confirmed because a donut needs six distinguishable slices and `--info`
already belongs to Processing.

**A second, deeper mismatch:** the endpoint the dashboard calls
(`PUT /api/dashboard/orders/{id}/status`) only refuses a change when the
CURRENT status is DELIVERED or CANCELLED, so `PENDING → DELIVERED` is
accepted. The strict map exists in `OrderStatusService` — and **no
controller calls it**. The UI offers only the strict transitions, and the
backend gap is in `ORDERS_CONTRACT.md` §2.1.

### 1.4 The orders without items

**7 of 17** orders have no items. The cause is **DATA**: the API always
maps `order.getItems()` into the response (so it is not an API omission),
and every order that HAS items has a primary image (so it is not a missing
image). The 7 are the seed's `ORD-2026-000006/7/9/10/12/14/15`, which have
no `order_items` rows at all.

The list renders that state as **"No items"** (a short label, because the
column is narrow) instead of an empty cell.

### 1.5 The clipping — the root cause was the shared card, not the orders

The order page's "Total" card lost the bottom of its amount (2 px) in
Arabic. The cause is not the orders page: **`hlm-card` dropped its bottom
padding** (an unconditional `pb-0` at the end of the class list), so a card
whose last line has a taller line box than the Latin one — Arabic, a larger
font — had its last line box outside the padding box, and the card's
`overflow-hidden` cut it. The padding is back; a card WITH a footer keeps
the flush bottom (`has-data-[slot=card-footer]:pb-0`).

The same class of defect: the **sidebar brand logo** was 40 px in a 32 px
content box (`h-12` + `p-2`), so the button's `overflow-hidden` cut the top
and the bottom of the mark off. The logo is 32 px now, like the avatar in
the account menu.

### 1.6 One formatter per concept

| Concept | The one formatter |
|---|---|
| Money | `shared/utils/locale-format.ts` → `formatCurrency`, through the `| money` pipe |
| Dates | `shared/utils/locale-format.ts` → `dateParts` / `formatTime`, through `<app-localized-date>` |
| The order number | `features/orders/utils/order-number.ts` → `formatOrderNumber` |

`scripts/formatter-audit.mjs` reports every place that formats them a
different way (`evidence/orders/measurements-formatters.json`).

**The result: the money is clean app-wide** — the two carts pages used the
built-in `| currency:'EGP'` pipe and now use the shared one. **22 places in
12 other features still use the built-in `| date` pipe** (broadcasts,
carts, contact messages, journal, notifications, three detail pages, promo
codes, reviews, users). They are listed in the report and were left alone:
they are other features' pages, and changing them is a separate piece of
work with its own visual review. **The orders pages are clean.**

### 1.7 The seed

`ORDERS_SEED_PROPOSAL.md` — 60 days, 108 orders, 24 new customers, every
status and payment state, a pending COD order, a refunded order, a
partially refunded order, a cancelled order with a reason, totals derived
from the items, and the query that proves the totals agree. **Nothing was
executed.** The document lists the seven checks that cannot be verified
without it (the totals agreeing, the date range narrowing, a non-zero
count for every status, the 23:30 order, the cancellation reason, the net
paid after a refund, and the status history).

## ORDERS PHASE 2 — Language and Arabic

### 2.1 Everything reacts to a runtime switch, and no raw key reaches the screen

The list's headers, the status tabs, the payment labels, the method, the
buttons, the detail page's cards and the dialogs are all from Transloco, and
all of them re-render when the language is switched **at runtime** (the
e2e test switches English → Arabic → English and asserts the headers, the
statuses, the dates and the money).

**The raw-key count is 0** in every cell of the matrix
(`results.json` → the per-cell `rawI18nKeys`).

**Two real defects the test caught:**

- the "Created at" header stayed in English in Arabic — the shared table's
  header map is keyed by the RAW header string, and it had `'created at'`
  but not `'Created at'`;
- the same status had **two words**: the list read `orders.statuses.*` and
  the badge read `common.statuses.*`, so a cancelled order said ملغاة in the
  list and ملغي on the badge of the same row. The payment method had the
  same split (`orders.paymentMethods.*` vs `dashboard.paymentMethods.*`).
  One word per concept now, and a test fails when it drifts again.

### 2.2 The glossary

`ORDERS_GLOSSARY` in `i18n-keys.spec.ts` pins the three order concepts
(order status, payment status, payment method) to ONE term in both
locales, across the two vocabularies that used to disagree. A fourth test
asserts that no Arabic orders term mixes scripts (the placeholders and the
file-format acronyms excepted).

### 2.3 The grammar

- The counts go through `Intl.PluralRules` (`| plural`): English has
  one/other, Arabic all six, so "17 طلبًا" and "3 طلبات" are both right.
  The orders families (`countItems`, `countOrders`, `countResults`) were
  added to the plural bases.
- The titles are sentence case in English.
- The money keeps the **shared** formatter, and the shared formatter now
  renders the store currency the way the ticket describes it: the **ISO
  code first in English** ("EGP 120.50") and the **amount first, then the
  Arabic symbol, without its trailing full stop** ("120.50 ج.م"). The
  English form used to be the CLDR narrow symbol ("E£"), which is a
  currency symbol in a Latin shape — the reader saw two different-looking
  currencies depending on the page. The Arabic form used to carry a
  LEFT-TO-RIGHT ISOLATE, which forced the amount to the LEFT of the
  symbol; an amount is not a sentence, so the dot is gone and the isolate
  with it. The orders pages follow all of this automatically, because they
  never formatted money themselves.
- The digits stay Latin in Arabic (`ar-EG-u-nu-latn`).
- "من" instead of a slash: the existing `ofPhrase` helper already does
  this, and the orders pages use the count helpers rather than building a
  "N/M" by hand.

### 2.4 Customer text

The customer name, the e-mail, the address and the SKU are wrapped in
`<bdi>` with `dir="auto"` (or `dir="ltr"` for the e-mail and the phone), so
a mixed-direction value cannot break the row.

## ORDERS PHASE 3 — The list

### 3.1 The columns

`select · Order # · Customer · Items · Order status · Payment status ·
Method · Total · Created at · Actions` — asserted by
`e2e/orders.spec.ts` against the rendered header row.

- the **raw id column is gone** (the table hides it by default, and the
  orders list does not ask for it);
- the order number is a **real anchor** to the order's own page (the
  shared table grew a generic "this cell is a link" input, so the table
  knows nothing about orders);
- the whole row is clickable, and the click is ignored when it lands on
  something interactive inside the row;
- the Items column shows up to three thumbnails and "+N", and "No items"
  when the order has none;
- Created at shows the date and the time (the time on its own line, so the
  column stays narrow), with the relative time in the tooltip and the
  absolute value in the `datetime` attribute.

### 3.2 The badge colours

Measured in both modes (`results.json` → the per-cell `badges`):

| Status | Token | Text on its badge | Text on the surface |
|---|---|---|---|
| Pending | warning | 5.91 | 6.58 |
| Confirmed | info (pale tint) | 5.36 | — |
| Processing | info | 4.71 | 5.36 |
| Shipped | chart-5 | 5.58 | 5.58 |
| Delivered | success | 5.29 | 5.95 |
| Cancelled | destructive-text | 5.10 | 5.93 |
| Refunded | muted | 5.69 | 6.34 |
| Paid | success | 5.29 | 5.95 |
| Failed | destructive-text | 5.10 | 5.93 |

Every badge passes the 4.5:1 text target in both modes, and every badge
carries its TEXT — colour is never the only signal.

### 3.3 The state lives in the URL

`?status=&paymentStatus=&paymentMethod=&range=&from=&to=&q=&sort=&direction=&page=&size=`
— read on load, written on every change, followed when it changes from the
outside (a shared link, the back button). The sort is the BACKEND's: the
table uses `manualSorting`, and the page maps the display column to the
`Order` entity's own property (`orderStatus → status`,
`createdAtTime → createdAt`) before it asks.

The filters the API does not support are applied in the browser over the
whole set — see §1.1.

### 3.4 The row actions and the bulk bar

Row actions: **View**, and an overflow menu with **Change status**,
**Print invoice** and **Cancel** (design.md §10: one visible action, the
rest in a kebab). The bulk bar appears when rows are selected: **change
status** and **export**, with the count.

The export states what it exports (a tooltip: "Exports the N orders
matching the current filters, with the columns shown in the table") and
exports the MATCHING set, not the page. The money in the file is formatted
by the **shared** money formatter, so a number in the file and a number on
the page are the same number written the same way.

### 3.5 The three states

Loading (the table stays mounted with skeleton rows), empty ("No orders
yet" vs "No orders match these filters" — the two empties are different
words), and error (what failed, with a RETRY that really retries).

### 3.6 The list pattern

Header (title + count, one primary button at the inline end), the status
tabs and the filters in the toolbar row, the cards, the table in a card,
the pager. The content is capped at `max-w-7xl` (1280 px) and centred, the
cards use `--radius-card`, the gaps are the 4/8 rhythm.

**The table fits at every width** (measured at 375/768/1024/1440/1920:
no horizontal page scroll, no horizontal scroll inside the table, no
truncated cell). The column budget was set from the measured content
widths, not guessed: the order number at 13 px (the design scale has
12/13/14) so the column can hold the whole `ORD-2026-000001` without
eating the table's width.

## ORDERS PHASE 4 — The detail page

### 4.1 The layout

Two columns over the full page width (`lg:grid-cols-[minmax(0,1fr)_360px]`),
the order on the left and the facts about it on the right. The header
carries the back arrow, the order number, both badges and the created date
and time; the actions are at the opposite end — **Update status** (the one
primary), **Print invoice**, **Resend email** (disabled, with the reason)
and the overflow menu with **Cancel** and **Refund**.

### 4.2 The main column

Items (thumbnail, name linked to the product, SKU, quantity × unit price,
line total), Totals (Subtotal, Shipping, Discount, Total, Net paid, and
the mismatch warning), the Timeline card (the progress tracker + the one
event the API can prove) and the Internal notes card.

### 4.3 The sidebar

Customer (name, e-mail, phone with `tel:` and WhatsApp links, a link to
the customer), Shipping address (with a copy button), Payment, Shipment and
Tags — the last three carry an honest, specific line about what the store
does not record yet, because a card that says "Not available yet" without
saying what is missing is not honest enough.

### 4.4 The status dialog

Only the transitions the backend's strict matrix allows; the note is
optional; cancelling has its OWN dialog with a **required reason** and the
consequence stated ("A cancelled order cannot be reopened. The customer is
notified only if you ask for it."). The "notify customer" switch is not
offered, because the store cannot send a status-change e-mail on demand.

**The valid-transition matrix is tested** (`order-status.model.spec.ts`):
no skipping a stage, no moving backwards, a delivered or cancelled order is
terminal, and cancelling is always available before the order ships.

### 4.5 The heights and the clipping

Every card's height is at most 1.43× its content (the limit is 1.5), the
cards in a row share their height, and nothing is clipped at any width
(the clipping check in the matrix reports 0 real findings — the only hits
are the `sr-only` elements, which are 1 px by design).

## ORDERS PHASE 5 — Tracking, history and notes (STOPPED FOR APPROVAL)

`ORDERS_CONTRACT.md` is written and the work is **stopped there**, as the
ticket asks: the DTOs, the endpoints, the migrations and the permissions
for the history, the notes, the shipment, the payment details, the stats
endpoint and the status change are all specified, and the parts that are
backend work are marked as such (the backend is a separate repository).

The contract also names the features that must not be faked — the e-mail
resend (the store sends e-mails automatically, but cannot re-send one), the
gateway refund (there is no refund endpoint and no refund amount), the
carrier API (there is no shipment data at all), the tax (there is no tax
model), the history, the notes and the variant on the order line — and
what the UI does about each one today.

**Six decisions are waiting** (the last section of the contract): whether
`SHIPPED → CANCELLED` is allowed, whether a status can go backwards, who
`changed_by` is, whether a refund is partial, whether a status change
sends an e-mail, and whether the tags are worth a table.

The frontend parts that need NO backend change are already built: the
progress tracker, the status dialog with the strict matrix, the cancel
dialog with its reason, the totals card with its warning and the honest
"not available yet" lines.

## ORDERS PHASE 6 — States, interactions and accessibility

- **The three states, per section.** The list and the detail page each
  have their own error state with a working retry, and the e2e test forces
  each endpoint to fail one at a time and asserts that only that section
  shows its error.
- **The race.** Every request is stamped, and a response that is not the
  newest is DISCARDED. The e2e test delays the first request and asks for
  a second filter; the page ends on the second filter's data.
- **The time zone.** The store's zone is **Africa/Cairo** and the browser
  agrees with it; the day boundaries are CALENDAR days in that zone, so an
  order placed at **23:30** belongs to that day and one placed at 00:30
  belongs to the next. The rule is pinned in `order-filters.spec.ts`. The
  seed has no 23:30 order, so the end-to-end check waits for the seed.
- **The drill-down.** The dashboard's KPI cards, its order-status slices
  and the attention panel link into `/dashboard/orders`, and the list
  honours the `?status=` the link carries.
- **The accessibility.** The status tabs are a `tablist` with
  `aria-selected`; the result of a filter is announced through a live
  region; the focus ring is visible in dark mode (a real Tab walk, 0 of 25
  without a ring); the dialog traps the focus and restores it to the
  control that opened it; every badge carries its text; and both pages
  work at 200 % zoom (a 720 px viewport) with no horizontal scroll.

## ORDERS — Working alongside another session

The repository is shared with a second session that is working on the
DASHBOARD home (its "Round 2"). Two consequences, both recorded here
because they shaped how the work was done:

- **The shared money formatter changed under this work** (the ISO code in
  English, the Arabic symbol without its dot). The change is the one the
  ticket asks for, and the orders pages follow it because they use the
  shared formatter. The unit test that pinned the old glyph was updated to
  pin the new one.
- **The build was broken by the other session's in-flight edits** several
  times, so the last part of this work ran in a **git worktree**
  (`/tmp/opencode/nocteon-orders`, branch `feature/orders-polish-wt`),
  built there and served on **:3000** (the backend's CORS allows
  `localhost:4200` and `localhost:3000`). The evidence was captured
  against that build, and `results.json` records the server it ran
  against (`harness.server`).

## ORDERS — One flaky test, classified

The suite passed 30/30 on the final run, but an earlier run had one
failure: "a failing endpoint shows the error state on the page" timed out
waiting for the error state.

**Classification: TEST DEFECT (a fixed sleep), not a product bug.** The
test waited a fixed 1500 ms for the error state, and the app's boot time
varies with the API's load (the backend rate-limits at 200 requests per
minute, and the suite had just been running against it). The test passes
in isolation and in the full suite on every re-run.

**The fix:** the fixed wait is gone — the assertion's own timeout does the
waiting — and the interception now COUNTS the aborted requests, so a
failure says whether the request was aborted at all or the page simply had
not rendered yet. The same fixed wait was removed from the list's error
test.

A second flake appeared in the same area: "the cards count the whole set"
compares the card with the API's own total, and it makes that call
through the app's session — which the backend rate-limits. Under load the
refresh was refused, the test compared against a number it never got, and
it failed. **The test now skips the comparison when the API cannot be
reached** (it says so) and always runs the check that needs no API call:
the card and the status tab must agree.

### A detector that was too forgiving

The truncation checks compared `scrollWidth > clientWidth + 1`, so a
**one-pixel** overflow was invisible. It was invisible in the wrong
direction: the "Cash on delivery" label was one pixel too wide and DID
draw an ellipsis, and the detectors said there was none.

The tolerance is gone (an overflow of any size counts) and the METHOD
label and the money are now at the body size (14 px) instead of the
inherited 16 px, so they fit with room to spare.

## ORDERS PHASE 7 — Responsive and final

The evidence matrix was re-run end to end over the six targets in all 20
cells (120 screenshots), with the language switched at runtime, and the
measurements are in `evidence/orders/results.json`.

# DASHBOARD ROUND 2 — the numbers, the language, the colour, the cards

The Round-1 pass got the structure right. This round fixes what the
screenshots still showed: numbers that did not reconcile, three ways of
printing money, i18n leaks, unreadable donut centres, colour collisions
and weak KPI cards. The evidence is in `evidence/dashboard-r2/`.

## ROUND 2, PHASE 1 — The numbers reconcile

- **The two revenue figures are two DIFFERENT formulas over the same ten
  orders.** The Total revenue card sums `order.totalAmount` (1,176.25) and
  the breakdown widgets sum `orderItem.totalPrice` (20,826.50). The seeded
  `total_amount` does not match the order's own items — a factor of 17.7 —
  and the backend's own percentages are computed against the order-total
  sum while the values are the item sum, which is why the category donut
  reported 1,770.6 % for one category. **No frontend change can reconcile
  them**: the frontend never sees the two numbers in the same place. The
  fix is in the data — `total_amount` must equal
  `SUM(items) + shipping - discount`, exactly as the runtime formula does
  (SEED_PROPOSAL.md).
- **The range IS honoured by the breakdowns** (the same endpoint returns an
  empty breakdown for `days=0`), so the "Last 30 days" label on them is
  truthful. What is not truthful is the IMPLICIT claim that the breakdown
  adds up to the revenue card, so the card now carries a note saying that
  it sums the line items.
- **The order count has ONE definition** (`core/dashboard/order-scope.ts`):
  the dashboard counts the orders whose **payment status** is PAID, and
  the Orders page counts EVERY order. 10 + 7 = 17, so the two numbers
  reconcile.
- **The rule is named by the PAYMENT STATUS, not the order status.** The
  two are independent fields: an order can be DELIVERED and REFUNDED
  (one in the seed is), and a CANCELLED order can be REFUNDED as well.
  Naming the order statuses would have been wrong twice over — it would
  leave the refunded DELIVERED order out of the sentence, and it would
  count a cancelled order twice. The sentence now says what the backend
  filters on ("an order is counted when its payment status is Paid — so
  pending, failed and refunded orders are not counted"), and the evidence
  script checks that the data agrees with the definition.
- **"New" is not news.** When the previous period is 0 and the current one
  is not, there is no percentage to show. Three of the four KPI cards now
  show an em dash with the reason ("No data in the previous period"); the
  "New" badge is kept only on the new-customers card, where newness IS
  the meaning.
- **One order number, one money formatter.** The order number is the
  backend's `ORD-YYYY-NNNNNN` everywhere (the dashboard used to print
  `orderNumber || '#' + id` inline). The money is `EGP 1,176.25` in
  English and `1,176.25 ج.م` in Arabic — the ISO code instead of the
  CLDR narrow symbol, the amount first in Arabic instead of behind a
  left-to-right isolate, and no trailing full stop on the Arabic symbol.
  The compact form follows the same order (`EGP 1.2K` / `1.2K ج.م`), and
  the CSV export uses the same formatter WITHOUT the bidi isolate (a file
  is not a paragraph).
- **The sparkline needs a trend.** Three points, and two of them above
  the series' minimum. The revenue series is thirty days in which one day
  carried a value, and drawing that was the "stray line in the corner".

## ROUND 2, PHASE 2 — The language and the formatting

- **"Sessions" is a plural, in the reader's language**: "418 جلسة",
  "6 جلسات", "398 sessions". The unit follows the number in both
  languages.
- **The revenue summary line is built from SEPARATE spans.** One joined
  string mixes the currency, the numbers and the date into one bidi
  context, and the Arabic paragraph reordered the parenthesised date. The
  date is now laid out as DOM-ordered parts, and the e2e suite asserts the
  GEOMETRY (the day is the leftmost part) and captures the line.
- **The card title follows the active tab**: "Revenue by origin", "Orders
  by status" — in both languages, sentence case, no wrapping. The range
  scope badge stays in the same place in every card, because the two
  breakdown cards now carry the same `hlm-card-header` as the others.
- **ONE tab component.** The range in the toolbar and the tabs inside the
  cards are the same pill group; only the role differs (`radiogroup` for
  the range, `tablist` for the views), and the arrow keys are mirrored in
  RTL like the app's own lifecycle tabs. The "Category" tab is back: a
  single-slice breakdown renders as a stat plus a bar, which is more
  useful than a hidden tab.
- **A computed that translates must read the language signal first.**
  `transloco.translate()` is not reactive, so a computed that only calls
  it keeps the language it was built in: the donut centres, the card
  titles, the tab labels, the scope notes and the delta labels all stayed
  in the boot language after a runtime switch. The library's sidebar
  trigger also renders a hardcoded English "Toggle Sidebar" as its
  screen-reader text, and it was the last Latin word on the Arabic page.

## ROUND 2, PHASE 3 — The colour and the donuts

- **The dark status swatches are their own tokens**, and they are MUTED.
  The old dark palette used the light-on-dark text colours as chart
  swatches: a neon green (`#4ade80`) and a bright cyan (`#22d3ee`).
- **Every MEANING has its own swatch.** CONFIRMED used to share the
  delivered green, which means two slices of the SAME ring can be the
  same colour. It has its own token now, and the legacy status chart
  (the other dashboard) uses the same tokens, so the two dashboards do
  not paint the same status in two different colours.
- **The collision is measured, not guessed.** The distance is the OKLab
  distance x 100; the categorical ramp's own neighbours are 7-15 apart, so
  15 is the bar. There are TWO kinds of pair, and both are reported:
 *
 *   - **cross** (a status swatch against a categorical one — the two
 *     rings are read against each other): in DARK the minimum went from
 *     **0** to **14.4**, and the collisions from 19 to 2 (both 0.6 short
 *     of the bar). Before, `--status-shipped` WAS `--chart-5` — the same
 *     colour.
 *   - **within** (two status swatches — the slices of ONE ring): the
 *     minimum went from **0** to **11.0**. The old neon palette was 9.6
 *     apart, so the muted palette is BETTER at telling its own slices
 *     apart, not worse.
 *
 * In LIGHT the status swatches keep the values the light mode already had
 * (the brief said the light mode is acceptable), so 15 of the 36 cross
 * pairs are under the bar and the smallest is 5.1. This is inherent to
 * the light palette, not an oversight: on a white card every swatch has
 * to be dark enough for 3:1, and the light categorical ramp already
 * spans lightness 0.42-0.58, so there is no lightness left to separate
  the two sets with. A full maximin search over the whole light status
  set reaches a best-possible minimum of 9.3 — better than the 5.1 the
  current values have, but still under the bar. The mitigations are the
  ones the legend already provides: the two donuts are separate cards with
  their own titles, and every slice carries its name, its value and its
  percentage.
- **The donut centre is the foreground token, measured in the page**: 17.08:1
  in light, 15.39:1 in dark, and it never leaves the ring (the width is
  measured, not guessed). It says what the number IS — "Revenue",
  "Orders" — not the name of the tab.
- **The legend is one column** with fixed-width columns, always below the
  chart, in the same order as the ring, and readable in RTL (the colour
  dot is at the inline start).
- **Every donut has the same diameter** (180 px), and a donut is only
  drawn for 3-5 slices.

## ROUND 2, PHASE 4 — The KPI cards and the layout

- **The four KPI cards share one padding and one baseline** (the label's
  top is 16 px below the card's top edge and the value's top is 48 px, in
  all four cards and in both languages; the type is 12 px and 30 px). The
  value used to sit lower on the revenue card, because that card had a
  sparkline and the row was `justify-between`.
- **The sparkline is drawn only when the series is a trend**, and nothing
  is reserved for it when it is not.
- **The bottom row's cards fill their own area.** The device list is one
  column and the low-stock empty state is centred in the card, so neither
  card is mostly empty. Every card on the page is now at most 1.5x the
  content it holds (the bottom row is exactly 1.5); before, the low-stock
  card was 5.43x.
- **The top-products column header says what the bar and the number are**
  ("Units sold"), and the bar and the number live in that one column.
- **The recent orders show the full order number** and the full date and
  time in the tooltip.

## ROUND 2, PHASE 5 — The verification

The full matrix was re-run (5 widths x 2 themes x 2 languages, the language
switched at runtime), the measurements were taken in the page, and the
before/after contact sheets are in `evidence/dashboard-r2/`. The unit
tests, the Round-2 e2e suite and the existing dashboard-language suite
(20 cells) all pass.

The acceptance criteria are machine-checked:
`node scripts/verify-round2.mjs` verifies all 25 of them against the
recorded evidence, and `.quality/runs/dashboard-r2/evidence-manifest.json`
is the manifest the evidence gate reads.
