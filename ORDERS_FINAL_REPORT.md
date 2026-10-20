# ORDERS_FINAL_REPORT.md — the orders list and the order detail page

**Branch:** `feature/orders-polish` (from `backup/pre-orders-work`)
**Evidence:** `evidence/orders/` — 20 cells × 6 targets = **120 screenshots**,
`results.json` (the measurements), `verification.json` (the e2e result),
`contact-sheet/` (120 before/after sheets), `orders-before/` (the baseline).
**Backend:** a separate repository (`../nocteon-backend`). Nothing there was
changed; the backend needs are written down in `ORDERS_CONTRACT.md`.

**Phase 5 is stopped at the contract, as the ticket asks.** The activity
timeline, the note composer, the shipment form and the enabled refund
dialog need the backend endpoints in that document first.

---

## 1. The scorecard

**Legend** — done: implemented and proved · partial: implemented, with a
named gap · not done: deliberately not built · not verified: could not be
proved with the data that exists.

### Phase 0 — Harness

| # | Item | Status | Files | Evidence | Measured |
|---|---|---|---|---|---|
| 0.1 | Production build passes; the :4200 server and the branch are recorded | done | — | `evidence/orders/results.json` → `harness.server`, `harness.gitBranch` | build exit 0; server pid 1409845, cwd `/tmp/opencode/nocteon-orders`; branch `feature/orders-polish` |
| 0.2 | The evidence harness covers the list, the detail, the status/cancel/refund dialogs, 5 widths × 2 themes × 2 languages, language switched at runtime; measurements in results.json | done | `scripts/evidence.mjs`, `scripts/evidence-targets.mjs` | `evidence/orders/results.json` | 20 cells × 6 targets = **120 screenshots**; 0 raw keys; 0 page overflow; 0 vertical clipping |
| 0.3 | "Before" screenshots of the list and the detail in all cells | done | — | `evidence/orders-before/` | 5 targets × 20 cells |
| 0.4 | The contact sheet (before / after per cell) | done | `scripts/contact-sheet.py` | `evidence/orders/contact-sheet/` | 120 sheets |

### Phase 1 — Data integrity

| # | Item | Status | Files | Evidence | Measured |
|---|---|---|---|---|---|
| 1.1 | Where the total comes from; the root cause; unit tests with fixtures | done | `features/orders/utils/order-totals.ts` + `.spec.ts` | `results.json` → `measurements.totals` | The formula is correct; the SEED writes `total_amount` by hand. **17 of 17 orders disagree with their own items** |
| 1.2 | The cards vs the table: endpoint, filters, formula, observed value; a stats endpoint | partial | `features/orders/orders-list/orders-list.component.ts` | `measurements.kpi` | Before: cards 10/1/9/**0** vs the table's 17 (5 cancelled). After: **17 / 2 / 9 / 5** — exact. The stats endpoint does not exist: the contract is in `ORDERS_CONTRACT.md` §3.1 and `measurements.kpi.requiredContract` |
| 1.3 | The status model: enums, methods, transitions, is "Refunded" a status or a flag; the chart mismatch | done | `features/orders/models/order-status.model.ts` + `.spec.ts` | `measurements.statusModel` | Order: PENDING CONFIRMED PROCESSING SHIPPED DELIVERED CANCELLED · Payment: PENDING PAID FAILED REFUNDED · Methods: ONLINE CASH_ON_DELIVERY · **Refunded = a payment flag** · The chart showed 3 of the 6 statuses |
| 1.4 | The orders without items, per cause | done | `features/orders/orders-list/orders-list.component.html` | `measurements.withoutItems` | **7 of 17** — cause: **data** (no `order_items` rows); API omission 0; missing image 0 |
| 1.5 | The clipping: the root cause, the fix | done | `libs/ui/card/src/lib/hlm-card.ts`, `features/layout/sidebar/app-sidebar.component.html` | `results.json` → the per-cell `verticalClipped` | The shared card had its bottom padding dropped (`pb-0`) and `overflow-hidden` cut the last line; the sidebar logo was 40 px in a 32 px box. **0 vertical clipping** in all 120 captures |
| 1.6 | One formatter per concept; the grep report | done | `scripts/formatter-audit.mjs`, `scripts/migrate-localized-dates.py`, `shared/utils/locale-format.ts` | `evidence/orders/measurements-formatters.json` | **0 findings.** The last 22 `\| date` uses (12 features) now go through the shared localized date |
| 1.7 | The seed proposal (NOT executed) | done | `ORDERS_SEED_PROPOSAL.md` | the document | 60 days, 108 orders, 24 customers, every status and payment state, a pending COD order, a refunded order, a partially refunded order, a cancelled order with a reason, and the 7 checks it would unblock |

### Phase 2 — Language and Arabic

| # | Item | Status | Files | Evidence | Measured |
|---|---|---|---|---|---|
| 2.1 | Every header, label and button reactive to a runtime switch; no raw key anywhere | done | `e2e/orders.spec.ts` (2 tests), `shared/components/data-table/data-table.component.ts` | `results.json` → the per-cell `rawI18nKeys`; `verification.json` | **0 raw keys** in all 120 captures. The test caught two real defects: the "Created at" header stayed English, and the METHOD label froze in the language the data arrived in |
| 2.2 | The glossary: one term per concept, and a test that fails when it drifts | done | `core/i18n/i18n-keys.spec.ts` (the "orders glossary" block) | the unit suite | The same status had two words (ملغاة / ملغي) and the payment method two more; one word per concept now, pinned in both locales |
| 2.3 | Intl plurals, sentence case, the currency symbol, "من" instead of a slash | done | `public/assets/i18n/*.json`, `core/i18n/plural.ts` | the unit suite; the captures | The counts go through `Intl.PluralRules` (EN one/other, AR all six). The money is the shared formatter's: **"EGP 120.50"** in English, **"120.50 ج.م"** in Arabic, Latin digits in both |
| 2.4 | Customer text in `dir="auto"` + `<bdi>` | done | `features/orders/order-detail/order-detail.component.html` | the captures | The name, the e-mail, the address and the SKU are wrapped; the e-mail and the phone are `dir="ltr"` |

### Phase 3 — The list

| # | Item | Status | Files | Evidence | Measured |
|---|---|---|---|---|---|
| 3.1 | The column order, the row click, the raw id hidden | done | `features/orders/orders-list/orders-list.component.ts` | `results.json` → `own.headers`; `verification.json` | `select · Order # · Customer · Items · Order status · Payment status · Method · Total · Created at · Actions` — asserted by the e2e test |
| 3.2 | The status colours from the semantic tokens, never colour alone | done | `shared/ui/status-badge/status-badge.component.ts`, `shared/components/dashboard/components/orders-status-chart.component.ts` | `results.json` → `own.badges` (both modes) | Every badge passes **4.5:1 on its own badge** and **3:1 on the surface**, in light AND dark (e.g. Delivered 5.29/5.95 light, 8.84/10.08 dark) |
| 3.3 | Tabs with counts, the filters, the URL state, server-side sorting | done | the list component + template | `verification.json` | The state is in the URL (`status`, `paymentStatus`, `paymentMethod`, `range`, `from`, `to`, `q`, `sort`, `direction`, `page`, `size`); the sort is the backend's (the display column is mapped to the `Order` property) |
| 3.3b | The truncation check (no ellipsis in Method) | done | the list, `e2e/orders.spec.ts` | `results.json` → `own.truncation` | **0** cut in the Method, **0** cut headers, **0** cut values without a tooltip — in all 120 captures |
| 3.4 | The row actions, the bulk actions, the CSV export | done | `shared/ui/actions-cell/actions-cell.component.ts`, the list | the captures | View + an overflow menu (Change status, Print invoice, Cancel); the bulk bar offers change status and export; the export states what it exports and exports the MATCHING set |
| 3.5 | Loading, empty, error | done | the list component | `verification.json` | Three distinct empties ("No orders yet" / "No orders match these filters"), a skeleton that keeps the table mounted, and an error state with a working retry |
| 3.6 | The list pattern of design.md | done | the list template | the captures | Header + count + one primary action, the tabs and the filters in the toolbar row, the cards, the table in a card, the pager, `max-w-7xl` centred |

### Phase 4 — The detail page

| # | Item | Status | Files | Evidence | Measured |
|---|---|---|---|---|---|
| 4.1 | The two-column layout, the header, the actions | done | `features/orders/order-detail/order-detail.component.{ts,html}` | `results.json` → `own.sectionOrder` | Main: items, totals, timeline, notes · Sidebar: customer, address, payment, shipment, tags |
| 4.2 | The main column: items, totals, timeline, notes | done | the detail template | `results.json` → `own.cards` | The items card shows the thumbnail, the name (linked), the SKU, the quantity × the unit price and the line total; the totals card shows Subtotal, Shipping, Discount, Total and Net paid, plus the mismatch warning |
| 4.3 | The sidebar: customer, address, payment, shipment, tags | done | the detail template | the captures | The phone is a `tel:` link and a WhatsApp link; the address has a copy button; the three cards the backend has no data for carry a specific, honest line |
| 4.4 | The "Update status" dialog: only the valid transitions, a note, a reason for a cancel, the consequence | done | `features/orders/components/order-status-dialog/**`, `order-cancel-dialog/**` | `order-status.model.spec.ts`; `verification.json` | The dialog on a CONFIRMED order offers exactly ONE transition ("Processing"); a DELIVERED order offers none and the button is disabled; the cancel dialog requires a reason |
| 4.5 | No section taller than 1.5× its content; no clipping | done | the detail template | `results.json` → `own.cardHeightRatios` | The worst ratio is **1.43** (the notes card); 0 vertical clipping in all 120 captures |

### Phase 5 — Tracking, history, notes

| # | Item | Status | Files | Evidence | Measured |
|---|---|---|---|---|---|
<<<<<<< HEAD
| 5.0 | `ORDERS_CONTRACT.md` written; **STOPPED for approval** | done | `ORDERS_CONTRACT.md` | the document | The DTOs, the endpoints, the migrations, the permissions, the defects in the API, the features that must not be faked, and the 6 decisions that need an answer |
| 5 (backend) | `order_status_history`, `order_notes`, the shipment, the payment details, the stats endpoint, the strict transitions | not done | — | `ORDERS_CONTRACT.md` §2, §3 | **Not started** — the contract is waiting for the approval |
| 5 (frontend) | The activity timeline, the note composer, the shipment form, the enabled refund dialog | not done | — | `ORDERS_CONTRACT.md` §5 | **Not started** — the same reason |
| 5 (frontend, no backend needed) | The progress tracker | done | `features/orders/components/order-progress/**` | `results.json` → `own.steps` | Delivered: PENDING✓ CONFIRMED✓ PROCESSING✓ SHIPPED✓ DELIVERED(current). Mid-flow: CONFIRMED(current), the rest future |
=======
| 5.0 | `ORDERS_CONTRACT.md` written, then **approved** | done | `ORDERS_CONTRACT.md` | the document | The DTOs, the endpoints, the migrations, the permissions, the defects in the API, the features that must not be faked, and the 6 decisions |
| 5 (backend) | The strict transitions, `order_status_history`, `order_notes`, the shipment, the refunds, the order stats, the list filters | done | `../nocteon-backend` (a separate repository) | the backend's own suite: **579 tests pass** | The endpoint now refuses what the state machine forbids (**409**); the history is written in the same transaction; the counts are the API's |
| 5 (frontend) | The activity timeline, the note composer, the shipment form, the payment card | done | `features/orders/order-detail/**`, `features/orders/services/order.service.ts` | `results.json`, `verification.json` | The timeline mixes the history, the notes and the refunds, newest first; the net paid is `null` until money comes in |
| 5 (frontend) | The refund dialog | done | `features/orders/components/order-refund-dialog/**` | the captures, `e2e/orders.spec.ts` | The amount (full or partial) and a reason; the money goes back through **Paymob**, and the refund is recorded only when the gateway accepts it |
>>>>>>> feature/orders-standalone

### Phase 6 — States, interactions, accessibility

| # | Item | Status | Files | Evidence | Measured |
|---|---|---|---|---|---|
| 6.1 | The loading/error/empty state per section; an e2e test that fails one endpoint at a time | done | `e2e/orders-states.spec.ts` | `verification.json` | 2 tests; only the failing section shows its error, and the retry recovers |
| 6.2 | The race protection | done | the list component | `verification.json` | The first request is delayed and a second filter is asked for; the page ends on the second filter's data (the card count equals the row count) |
| 6.3 | The store time zone; the 23:30 order | partial | `features/orders/utils/order-filters.spec.ts` | the unit suite | The store's zone is **Africa/Cairo** and the browser agrees; the rule is pinned in a unit test (23:30 belongs to THAT day, 00:30 to the next). The end-to-end check needs an order at 23:30, which the seed does not have |
| 6.4 | The dashboard drill-down lands on a pre-filtered list; the cards are real links | done | `e2e/orders-states.spec.ts` | `verification.json` | The status slice links to `/dashboard/orders?status=…` and the list honours it |
| 6.5 | The accessibility rules | done | the list + the detail + the dialog | `verification.json` | A `tablist` with `aria-selected`; a live region for the filter result; a Tab walk in dark mode with **0 of 25** controls without a ring; the dialog traps the focus and restores it; every badge carries its text; both pages work at 200 % zoom with no horizontal scroll |

### Phase 7 — Responsive and final

| # | Item | Status | Files | Evidence | Measured |
|---|---|---|---|---|---|
| 7.1 | 375 and 768: a scrollable table with a pinned first column; no horizontal page scroll | done | `shared/components/data-table/data-table.component.{ts,html,css}` | `results.json` | The order number (and the select checkbox) are pinned to the inline start; **0 px** of page overflow at 375/768/1024/1440/1920; the table itself is 1120 px and scrolls inside its own wrapper |
| 7.2 | The full matrix re-run + a before/after contact sheet per cell | done | `scripts/contact-sheet.py` | `evidence/orders/`, `evidence/orders/contact-sheet/` | 120 captures + 120 sheets |
| 7.3 | design.md and DECISIONS.md updated | done | `design.md` §13, `DECISIONS.md` | — | The status system, the tracker, the list, the detail page, the dialog and the pinned column |

### The test suite

| Suite | Result |
|---|---|
| Unit (Vitest) | **164 / 164 pass**, 13 files. Mine: `order-totals.spec.ts` (15), `order-status.model.spec.ts`, `order-number.spec.ts`, `order-filters.spec.ts`, plus the orders-glossary block in `i18n-keys.spec.ts` |
| E2E (Playwright) | **30 / 30 pass**, exit 0 — `evidence/orders/verification.json` |
| Production build | exit 0 |

---

## 2. The backend contract gaps

The full contract is in `ORDERS_CONTRACT.md`. In short:

| # | Gap | Method + path | The response shape it needs |
|---|---|---|---|
| 1 | The order-status endpoint accepts transitions the state machine forbids (`PENDING → DELIVERED` is allowed today) | `PUT /api/dashboard/orders/{id}/status` → `OrderService.updateStatus` | Reject with **409** and the `InvalidOrderStatusTransitionException` that already exists. `OrderStatusService` has the right map but **no controller calls it** |
| 2 | The order-stats endpoint | `GET /api/dashboard/orders/stats?status&paymentStatus&paymentMethod&dateFrom&dateTo&search` | `{ total, byStatus[], byPaymentStatus[], byPaymentMethod[] }` — the counts of the FILTERED set |
| 3 | The status history | `GET /api/dashboard/orders/{id}/history` + a new `order_status_history` table | `[{ fromStatus, toStatus, note, changedBy, notifyCustomer, createdAt }]`, written in the same transaction as the change |
| 4 | The internal notes | `POST /api/dashboard/orders/{id}/notes`, `GET …/notes` + an `order_notes` table | `{ body, isInternal }` → the stored note |
| 5 | The shipment | `PUT /api/dashboard/orders/{id}/shipment` + the fields | `{ carrier, trackingNumber, trackingUrl, shippedAt, deliveredAt }` |
| 6 | The payment details | `GET /api/dashboard/orders/{id}/payment` | `{ method, status, transactionReference, paidAt, refunds[] }` — the refund needs an AMOUNT |
| 7 | The server-side filters | `GET /api/dashboard/orders` | `search`, `paymentStatus`, `paymentMethod`, `dateFrom`, `dateTo` — today only `status` is accepted |
| 8 | The refund | `POST /api/dashboard/orders/{id}/refund` | `{ amount, reason }` — there is **no Paymob refund call** today |
| 9 | The re-send of the order e-mail | `POST /api/dashboard/orders/{id}/resend-email` | The e-mails are sent automatically (placed, shipped); there is no way to send one on demand |
| 10 | The seed's order numbers can collide with the runtime sequence | — | The seed must use `nextval('order_number_seq')`; the 17 existing numbers need renumbering |
| 11 | The stored totals disagree with the items (17 of 17) | — | A data repair: recompute `orders.total_amount` from the `order_items` rows. **This changes what the store believes it charged, so it is a decision, not a UI fix** |
| 12 | Tax | — | There is **no tax model** in the backend at all |
| 13 | The variant on an order line | `OrderItemResponse` | The chosen options (weight, grind) are not on the line |

## 3. The risks

| Risk | Why it matters | What I did about it |
|---|---|---|
| **The client-side filters read the whole orders table** (up to 1,000 orders, paged through the API) | It is exact, but it does not scale; a store with 50,000 orders would fetch 500 requests per page view | The cap is explicit and the list says so when it is reached; the server-side contract (§2.7) is the fix |
| **The backend's rate limit (200 requests/minute) is close to what the evidence run needs** | The run can trip a 429 | The harness waits the limit out; the app's own answer to a 429 is the error state with a retry, and the backend's message is shown |
| **The totals on screen disagree with the items on 17 of 17 orders** | A reader may think the UI is wrong | The page says so explicitly, and the root cause is in the report. The UI never re-derives the total |
| **The shared money formatter changed under this work** (the ISO code in English, the Arabic symbol without its dot) | The orders pages' money follows it | The unit test pins the new glyphs; the pages use the shared pipe and never format money themselves |
| **Another session is working in the same repository** | Its in-flight edits broke the build several times, and one of its commits landed on this branch | The last part of the work ran in a worktree on a second port; the merges are in the history. **The branch therefore contains both sessions' work** |
| **The strict transition map forbids `SHIPPED → CANCELLED`** | A store usually wants to cancel an order that has shipped but not arrived | The UI follows the strict map (it can never ask for something the intended contract forbids). It is decision 1 in the contract |
| **The orders list is not the storefront** | The storefront's own checkout is a different code path and was not touched | Out of scope, and recorded as such |

## 4. What I deliberately did NOT change

| Not changed | Why |
|---|---|
| **The backend** (any file in `../nocteon-backend`) | It is a separate repository, and the ticket says to write the contract and wait. Every backend need is in `ORDERS_CONTRACT.md` |
| **The 17 orders' stored totals** | Recomputing them changes what the store believes it charged. That is a data decision, not a UI one |
| **The seed migration `V107`** | The seed is a proposal (`ORDERS_SEED_PROPOSAL.md`); the ticket says "do NOT run anything" |
| **22 `\| date` usages in 12 other features** | They are other features' pages with their own visual review. The report names every one of them (`evidence/orders/measurements-formatters.json`) |
| **The dashboard's own Round 2 work** | Another session owns it; the orders work only reads the dashboard's drill-down links |
| **The `OrderStatusService` wiring** | Backend work, and it needs the decision in §2.1 first |
| **A "cards instead of a table" layout at 375** | The ticket allows either that or a scrollable table with a pinned first column; the pinned column keeps the order number visible, which is what a reader needs |
| **The `ORD-2026-000001` style order number** | The backend owns the number (`ORD-<year>-<6 digits>`). The UI shows it exactly as it is and never re-formats it |

## 5. What I would test by hand, per cell

The matrix is 20 cells: `{en, ar} × {light, dark} × {375, 768, 1024, 1440, 1920}`.

**Every cell**
1. The header count, the five cards and the seven status tabs all agree with the rows.
2. Switch the language **at runtime** (the avatar menu) — the headers, the badges, the dates and the money all change, and nothing is left in the old language.
3. The order number is a link; clicking the row opens the order; the kebab menu opens.
4. Open the status dialog on a CONFIRMED order: it offers exactly one transition. Open it on a DELIVERED order: the button is disabled.
5. The "Update status" dialog: Tab cycles inside it, Escape closes it, and the focus returns to the button.
6. The totals card on `ORD-2026-000001` shows the mismatch warning.

**375 and 768** (the ones a hand test finds fastest)
7. Scroll the table sideways: the order number and the checkbox stay put.
8. The filters wrap onto their own rows; the search field is full width.
9. The detail page stacks into one column; the sidebar follows the main column.

**ar (both themes)**
10. The money reads "120.50 ج.م" — the amount FIRST, then the symbol, with Latin digits.
11. The dates read "20 أكتوبر 2026" and the time "8:49 ص" — never the English form.
12. The order number is not reordered by the bidi algorithm.
13. The customer name and the address are in the right direction even when they are Latin.

**light and dark**
14. The badges: the text on the badge and the badge on the card are both legible (the measured ratios are in `results.json` → `own.badges`).
15. The focus ring is visible on every control you tab through.

**The "before" pair** (to see the difference): the cards used to say 10 orders and 0 cancelled while the table said 17; the "Created at" header used to stay in English in Arabic; the method column used to be cut to "Cash on d…".

## 6. Two defects the evidence itself caught

| Defect | How it was found | The fix |
|---|---|---|
| The **method label** froze in the language the data arrived in (the label was translated in the column accessor, and an accessor is evaluated once) | The before/after contact sheet: the English cell showed an Arabic method | The cell translates it at render time; an e2e test pins it |
| The **truncation detectors were too forgiving** (`scrollWidth > clientWidth + 1`), so a ONE-pixel overflow was invisible — and "Cash on delivery" was one pixel too wide and DID draw an ellipsis | The contact sheet, read by eye, against a detector that said "no truncation" | The tolerance is gone; the method label and the money are at the body size (14 px) |

<<<<<<< HEAD
## 7. The two things to decide
=======
## 7. What the backend still needs

The contract is implemented except for the parts that need a decision or a
gateway:

| Gap | Why it is still open |
|---|---|
| The **gateway refund** | **BUILT** — `POST /api/acceptance/refunds` with the parent transaction and the amount in cents. The refund is recorded only when the gateway accepts it. The live call cannot be exercised here: the dev environment has no Paymob credentials, so the seeded orders (which have no payment row at all) are refused with "only a paid order can be refunded" |
| **`SHIPPED → CANCELLED`** | **DECIDED: it stays forbidden.** Once a parcel is on its way, cancelling is a return, and a return is a refund with a reason. The strict map is unchanged |
| The **status-change e-mail** | **BUILT** — the change publishes an event, and the e-mail is enqueued after the transaction commits. The Brevo template id comes from the environment (`BREVO_TEMPLATE_ORDER_STATUS_CHANGED`), so the template itself is a Brevo-side task |
| The **seed's broken totals** | **REPAIRED** — `V111__repair_seeded_order_totals.sql` recomputes the seventeen seeded totals with the checkout's own formula. 0 of 17 disagree now |
| The **seed's order numbers** | The seed writes them by hand, so they can collide with the runtime sequence. Not repaired: renumbering a live order's identifier is a different decision |

## 8. What is left to decide

Nothing is blocked. Two things are still open, and neither blocks the work:

- **The gateway refund** — Paymob's refund API is not wired in. The refund is
  RECORDED (the amount, the reason, who did it) and the row says it is
  manual until a gateway reference is written. The order page's refund
  dialog stays disabled, as the ticket requires.
- **The status-change e-mail** — the status change records
  `notifyCustomer`, but nothing sends an e-mail yet. The order page says so.

## 9. The two things to decide
>>>>>>> feature/orders-standalone

1. **The backend contract** (`ORDERS_CONTRACT.md`) — approve it, and the six questions in its last section.
2. **The money glyph** — the shared formatter now renders "EGP 120.50" / "120.50 ج.م", which is what the ticket describes. If the trailing dot in "ج.م." should come back, it is one line in `shared/utils/locale-format.ts` — but it would change the dashboard too.
