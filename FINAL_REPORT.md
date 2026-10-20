# Dashboard home — final report

**Scope**: the dashboard home page of the Nocteon dashboard, in six phases:
data integrity, language, the chart system, layout, states and interactions,
and responsive behaviour.

**Branch**: `feature/orders-polish` (work is committed on this branch;
`main` is untouched at `efde00ff`).
**Build**: `ng build --configuration production` — green.
**Unit tests**: 113 / 113 pass (10 spec files).
**E2E**: `e2e/dashboard-language.spec.ts` 20 / 20, `e2e/dashboard-states.spec.ts`
5 / 5, `e2e/verify-tables.spec.ts` 5 / 5.

**Evidence**: `evidence/phase0-before/` … `evidence/phase6/`, each with 20
screenshots (en/ar × light/dark × 375/768/1024/1440/1920) plus
`results.json`; `evidence/phase6/contact-sheet/` holds a before/after sheet
per cell.

---

## 1. Item-by-item

### Phase 0 — Harness

| # | Item | Status | Evidence | Measured |
|---|------|--------|----------|----------|
| 0.1 | Production build, dev server serves the latest build | done | `evidence/phase0-before/results.json` → `harness.server` | build exit 0; server pid 260106, cwd `/home/abdelrhman/…/nocteon-dashboard`, cmd `serve dist/nocteon-dash/browser -l 4200 -s`; served `index.html` MD5 identical to the build |
| 0.2 | `npm run evidence`, storageState, runtime language switch | done | `scripts/evidence.mjs` | 20 cells; language switched at runtime through the user menu; `document.lang`/`dir` asserted per cell |
| 0.3 | Before-screenshots | done | `evidence/phase0-before/` | 20 PNGs |

### Phase 1 — Data integrity

| # | Item | Status | Evidence | Measured |
|---|------|--------|----------|----------|
| 1.1 | Previous period: root cause, fixtures, no-arrow zero change | done | `evidence/phase1/results.json` → `measurements.previousPeriod`; `src/app/core/dashboard/{delta,period,period-fetch}.spec.ts` | root cause: `buildOverview(since, until, days)` **ignores `until`**, so `previous` = "everything since 2N days ago" ⊇ current. The client now derives the previous window as `overview?days=2N − overview?days=N`. 10 delta fixtures + 5 period fixtures + 4 fetch-plan fixtures |
| 1.2 | Revenue reconciliation table, truthful labels | done | `measurements.reconciliation` (14 widgets) | KPI 1,176.25 = `SUM(order.totalAmount)`; breakdowns 20,826.50 = `SUM(orderItem.totalPrice)`; top products imply 15,925 = qty × lowest variant price. **All breakdowns ARE range-filtered** (`days=0` → empty); the earlier "All time" label was wrong and is now "Selected period" |
| 1.3 | One currency formatter, Arabic symbol | done | `src/app/shared/utils/locale-format.ts`, `money.pipe.ts`, `locale-format.spec.ts` | `E£` (en) / `ج.م.` (ar), Latin digits; **grep: 0 money values outside the shared formatter** (`evidence/phase1/money-format-grep.txt`) |
| 1.4 | Refund rate definition, consistent with the status chart | done | `measurements.reconciliation.refundRate` | `COUNT(REFUNDED) / COUNT(PAID)` = 2/10 = 20 %; refunded is a **payment status**, so the chart is titled "Paid orders by status" |
| 1.5 | Seed proposal (no execution) | done | `SEED_PROPOSAL.md` | proposal only; nothing run. **10 of 10** PAID orders violate `totalAmount == items + shipping − discount` |

### Phase 2 — Language and Arabic correctness

| # | Item | Status | Evidence | Measured |
|---|------|--------|----------|----------|
| 2.1 | Reactivity, shared helpers, e2e test | done | `e2e/dashboard-language.spec.ts` (20/20), `measurements.rootCause` | three causes: `translate()` returns the key itself when missing (and `\|\| fallback` is dead code); the dictionary was not loaded before the flip; the breakdowns are localized by the backend and need a refetch; chart options are built once. Shared helpers: `LocalizedNameService`, `LocalizedDateService` |
| 2.2 | Plural grammar, "من", sign placement | done | `measurements.arabicGrammar.checks` | 30 يومًا · 7 أيام · 1 يوم · 365 يومًا · 8 مبيعات · 2 مبيعتان · 10 طلبات · 5 عملاء; "4 من 5 عملاء" (no slash); sign via `signDisplay: 'always'` + `<bdi>` |
| 2.3 | Glossary | done | `docs/glossary.md`, `i18n-keys.spec.ts` | "Needs attention" → **يحتاج انتباه** (was "تنبيهات" = "alerts"). 4 concepts pinned in both directions |
| 2.4 | Sentence case | done | `i18n-keys.spec.ts` | 16 widget titles checked for a capital anywhere but the start |
| 2.5 | Range scope in every header | done | `widget-header.component.ts` | one format: "Last 30 days" / "All time" (low stock is not a period metric); the scope is `shrink-0` and never wraps |

### Phase 3 — Chart system and colour

| # | Item | Status | Evidence | Measured |
|---|------|--------|----------|----------|
| 3.1 | Tokens, semantic colours, contrast | done | `measurements.contrastTable` (32 swatches × 2 modes), `design.md` §2, §2b, §5 | 6 categorical + 4-step roast ramp + neutral "Other"; cyan/periwinkle/lime removed; **31/32 pass 3:1**, the one exception `--roast-1` on light (2.03:1) is exempt (2 px gap + value label) |
| 3.2 | Type rules, one chart card, legend below | done | `chart-rules.ts`, `chart-rules.spec.ts` (19 assertions) | 0–1 → stat, 2 → bars, 3–5 and ≥160 px → donut, 6+ → bars; legend below in every case, every row has swatch + value + percent |
| 3.3 | Donut hole, centre, one diameter | done | `measurements.geometry` | hole transparent (card colour) in all; centre = `--foreground`; **0 donuts overflow the ring**; one diameter 170 px |
| 3.4 | Revenue chart | done | `revenue-chart.component.ts` | bars, 270 px, zero days included, tooltip date+value, dashed previous period, compact axis, month/day in the active locale, tick density by width, summary line, `aria-label`, "view as table" |
| 3.5 | Consolidation | done | `revenue-breakdown-card`, `orders-breakdown-card`, `device-list` | "Revenue by" tabs [Origin \| Roast level \| Category]; "Orders by" tabs [Status \| Payment method]; devices scaled to the max on the full track with a unit; a single-value tab is hidden (category, today) |

### Phase 4 — Layout and hierarchy

| # | Item | Status | Evidence | Measured |
|---|------|--------|----------|----------|
| 4.1 | One sticky toolbar | done | `measurements.toolbar` | one row, `position: sticky`, 55 px; range + comparison + export; `radiogroup` + `aria-live`; export tooltip names the content and the range; CSV has a UTF-8 BOM |
| 4.2 | Four KPIs + strip, delta chips, sparkline | done | `kpi-card.component.ts` | 4 primary (30 px tabular, chip, sparkline from the real series) + a compact strip; online users is a live indicator; the "vs previous period" caption is gone from the cards |
| 4.3 | Attention strip | done | `measurements.attentionStrip` | **48 px** one line when clear; rows with counts and links otherwise |
| 4.4 | Page structure and height | done | `measurements.pageHeight` | **2390 → 1696 px** (target 1700, met); row ratios 1.05–1.25 (≤ 1.5); 0 clipped cards |
| 4.5 | Top products, recent orders | done | `top-products`, `recent-orders` | units + a share bar, header says "Units sold"; order rows are links, relative dates, "View all" once |
| 4.6 | Spacing and style | done | `design.md` §10 | 1280 px centred, 24 px gaps, 12 px radius, no card shadows, tabular figures, 12 px muted labels at 6.34:1 / 6.41:1 |

### Phase 5 — States and interactions

| # | Item | Status | Evidence | Measured |
|---|------|--------|----------|----------|
| 5.1 | Loading / error / empty per widget, per-endpoint e2e | done | `e2e/dashboard-states.spec.ts`, `measurements.states` | overview fail → 2 error states + retry; settings fail → 1 alert; orders fail → 1 error state, KPI area still renders; loading skeleton observed on the wire; empty = the one-line low stock |
| 5.2 | Race protection | done | `e2e` test 2 | request id; a response that is not the newest is discarded; 7 → 90 → 7 verified |
| 5.3 | Range in the URL, refresh, back/forward, time zone, 23:30 | done | `e2e` test 3, `period.spec.ts` | the range survives a refresh and back/forward; store zone **Africa/Cairo**; the DB buckets days in **UTC** — so an order between 00:00 and 03:00 Cairo lands on the previous day in the backend's series; the 23:30 boundary is pinned by 5 unit tests |
| 5.4 | Drill-down | done | `e2e` test 4 | 4 KPI cards + status slices + attention rows are real links with pre-filters; the list pages read them from the URL |
| 5.5 | Accessibility | done | `measurements.accessibility` | radiogroup ✓ · `aria-live` ✓ · chart summaries ✓ · legend never colour-alone ✓ · **focus ring: 0 of 69 without a ring, in light AND dark** (keyboard Tab walk) · reduced motion ✓ · 200 % zoom: 0 px overflow, 0 clipped |

### Phase 6 — Responsive and final verification

| # | Item | Status | Evidence | Measured |
|---|------|--------|----------|----------|
| 6.1 | Grid 4 → 2 → 1, strip wraps, charts stack, no overflow | done | `measurements.results` (10 cells) | KPI grid 1/2/4 columns at 375/768/1024+; strip the same; charts 3 rows at 375–768, 2 at 1024+; **0 px horizontal scroll and 0 clipped text in every cell** |
| 6.2 | Before/after contact sheet | done | `evidence/phase6/contact-sheet/` | 20 sheets (one per cell) |
| 6.3 | design.md + DECISIONS.md | done | `design.md` §2, §2b, §5, §10, §11; `DECISIONS.md` | chart tokens, chart system, dashboard pattern, accessibility additions, and a decision log per phase |

---

## 2. Backend contract gaps

| Method + path | Status | What is missing / what was done instead |
|---|---|---|
| `GET /api/dashboard/stats/overview/compare?days=N` | **broken for the previous period** | The `previous` object is not a previous period: `buildOverview(since, until, days)` never uses `until`, so it is "everything since 2N days ago". **Used:** the client derives the previous window itself from `overview?days=2N − overview?days=N`. **Needed:** a range-bounded previous aggregate. |
| `GET /api/dashboard/settings` | **405** (PUT only) | The working read is `GET /api/settings` → `data.currency` ("EGP"), used by `StoreSettingsService`. |
| `GET /api/dashboard/stats/overview` | no per-product revenue | `topSellingProducts` carries `price` (the **lowest variant price**) and `quantitySold` — never the revenue earned. **Used:** the top-products list shows units + a share bar and says so in the column header. **Needed:** per-product revenue for a truthful "revenue" column. |
| `GET /api/dashboard/products` (filter) | no stock filter | `ProductFilterRequest` has only `inStockOnly` / `onSaleOnly`, and the rows carry no stock, so a "low stock" list page cannot be built from it. **Used:** the low-stock widget's rows link to each product; the missing filter is reported. |
| `GET /api/dashboard/orders` | no date range | `OrderFilterRequest` has no date fields, so the previous period cannot be computed from the order list either. |
| `GET /api/dashboard/stats/overview` → `revenueByDay` | day buckets are UTC | The database runs `Etc/UTC` and buckets with `CAST(createdAt AS date)`, while the store runs in Africa/Cairo (UTC+3). An order placed between 00:00 and 03:00 Cairo is counted on the previous day. The dashboard's windows are whole Cairo days; the mismatch is at most one day at the leading edge. |
| `GET /api/dashboard/stats/overview` → `deviceBreakdown` | **unstable** | The counts change between loads (they are cumulative and grow with traffic). The unit ("sessions") is the dashboard's reading, not the API's. |

---

## 3. Risks

1. **The previous-period derivation is a workaround, not a fix.** It assumes the
   backend's aggregate is a plain sum over a lower date bound. That holds for
   `SUM`, `COUNT` and the weight sum today, but a future change (a weighted
   average, a deduplicated count) would silently break the subtraction.
   `period-fetch.spec.ts` pins the assumption, not the backend.
2. **The revenue chart is 270 px, not the ~320 px of ticket 3.4.** The two
   requirements conflict: the five-section structure of 4.4 does not fit under
   1700 px with a 320 px chart. 270 px was chosen; a 320 px chart puts the
   page at ~1740 px.
3. **`--roast-1` is 2.03:1 on the light card** — below the 3:1 graphics
   target. It is the lightest step of a sequential ramp, so it cannot be made
   darker without flattening the ramp. It carries a 2 px card-coloured gap and
   a value label.
4. **The device breakdown is unstable and its unit is unconfirmed.** The card
   says "sessions" because that is the most likely reading of a cumulative
   device table, but the API does not label it.
5. **The seed data is internally inconsistent** (10/10 PAID orders), so any
   number derived from order totals disagrees with any number derived from
   line items. This is the root cause of the three different revenue figures
   and it will keep confusing readers until the seed is fixed.
6. **A concurrent process is working in this working tree** (branch
   `feature/orders-polish`, an "orders polish" refactor of the orders list
   and the shared data table). It was mid-flight during the final
   verification: the build was briefly red in `features/orders/**` and
   `shared/components/data-table/**`, and four unit-test failures came from
   its new code. The i18n key-set symmetry test was generalised by this work
   (it now discovers plural families instead of listing four) so that its
   families are handled too.

---

## 4. What was deliberately NOT changed

- **The backend.** No Java was touched. The `until`-is-ignored bug, the
  missing `?stock` filter, the missing per-product revenue and the UTC day
  buckets are all reported, not patched.
- **The seed data.** `SEED_PROPOSAL.md` is a proposal; no row was created,
  changed or deleted, and the dev database was never seeded.
- **The tests.** No assertion was weakened, skipped or deleted. The
  `verify-tables` carts contract was **fixed to pass** (the identity column
  now has its own share of the row), not relaxed.
- **The `money` formatter's callers.** 26 call sites were migrated to the
  shared formatter; the formatter itself kept its single entry point.
- **The device breakdown's semantics.** Left as the API returns it.

---

## 5. What to test by hand, per cell

The e2e suite covers the behaviour; these are the things a machine cannot
judge.

| Cell | What to look at |
|---|---|
| **en / light / 1440** | The reference. Read it top to bottom: the toolbar, the four KPIs, the strip, the attention line, the chart, the two breakdown cards, top products, recent orders, low stock, devices. Does the hierarchy match what you need on a Monday morning? |
| **en / light / 375** | Open the range control, the export button and a KPI card on a real phone. Is the sticky toolbar in the way? Does the chart axis stay readable? |
| **en / dark / 1440** | The donut hole against the card, the roast ramp, the "New" chips, the focus ring on a KPI card (Tab through). |
| **ar / light / 1440** | Read the Arabic: the range dates (21 سبتمبر – 20 أكتوبر), "30 يومًا" in the header, "2 من 10 طلبات", "4 من 5 عملاء", the donut legend, the axis months. Is the RTL layout right, and is the "من" phrasing natural? |
| **ar / dark / 1440** | The Arabic in dark, especially the donut centre text (contrast) and the status colours. |
| **ar / light / 375** | The Arabic at a narrow width — the range label, the tab strips ("المنشأ / مستوى التحميص / الفئة"), the legend rows. Do the tabs scroll when they must? |
| **ar / dark / 375** | As above, in dark. |
| **All cells** | Switch the range to 7 / 90 / 365 and back. Does the "All time" scope on Low stock stay "All time" while the others change? Does the URL follow? |

### By hand, per item

- **The export.** Click it, open the CSV: does Excel open the Arabic
  correctly (the BOM), and does the file describe the range you selected?
- **The drill-down.** Click a KPI card, a status slice in "Orders by", an
  attention row: does the list arrive filtered, and does the back button
  return you to the dashboard with the range intact?
- **The error states.** Stop the backend, reload: every widget says what
  failed and offers a retry. Start it again and press retry.
- **The empty state.** With the seed's no-low-stock-products, the low-stock
  card is one line. Decide whether that is quiet enough.
- **The 23:30 boundary.** Put an order in at 23:30 Cairo and check which day
  it lands on in the revenue chart — the backend buckets in UTC, so the
  dashboard and the chart can disagree by one day for orders placed between
  00:00 and 03:00.

---

## 6. Where the evidence is

```
evidence/
  phase0-before/     20 PNGs (the baseline) + results.json
  phase1/            20 PNGs + results.json + measurements.json
                     + money-format-grep.txt
  phase2/            20 PNGs + results.json + measurements.json
  phase3/            20 PNGs + results.json + measurements.json
  phase4/            20 PNGs + results.json + measurements.json
  phase5/            20 PNGs + results.json + measurements.json
  phase6/            20 PNGs + results.json + measurements.json
                     + contact-sheet/  (20 before/after sheets)
DECISIONS.md         the decision log, one entry per phase
SEED_PROPOSAL.md     the dev seed proposal (not executed)
design.md            the chart tokens, the chart system, the dashboard pattern
```
