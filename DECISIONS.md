# Decisions — product-options-pass-1

## Needs backend
- Option usage-count endpoint: frontend relies on the server's 409 (`OPTION_IN_USE`) for option delete because no `GET .../usage` endpoint exists for options (only value usage is partially exposed). To support disabling delete with a count tooltip, backend should expose a usage count for options.
- Value usage-count endpoint (`GET .../values/{id}/usage`) returns 404 in the current backend; frontend no longer calls it and relies on the 409 (`OPTION_VALUE_IN_USE`) with `data.variantCount`.

# Decisions — permissions-ui-1 (C tasks)

## C1/C2 — Permission slug verification

The task table's permission slugs were checked against the source of truth the
Roles page uses (`ALL_PERMISSIONS` in
`src/app/shared/utils/permission.utils.ts`) and the live `GET /api/dashboard/roles`
response (same slug sets returned to the UI).

| Slug | Real? | Notes |
|---|---|---|
| dashboard:read | yes | |
| order:read / order:update | yes | |
| cart:read_all / cart:manage / cart:notify | yes | |
| review:read / review:moderate / review:delete | yes | |
| product:read / product:create / product:update / product:delete | yes | |
| user:read / user:create / user:update / user:delete / user:change_role | yes | |
| contact:read / contact:update | yes | |
| notification:read / notification:update / notification:delete | yes | |
| settings:read / settings:update | yes | |
| audit:read | yes | route/page not implemented yet in the frontend — guard added where the page lands. |
| promo:read / promo:update / promo:create / promo:delete | yes | |
| shipping:read / shipping:update / shipping:moderate | yes | |
| journal:read / journal:create / journal:update / journal:delete | yes | |
| broadcast:read / broadcast:create / broadcast:delete | yes | |
| catalog references (category, origin, farm, roast_level, coffee_variety, processing_method, brewing_method, pairing, tasting_note) each with :read/:create/:update/:delete | yes | all present in ALL_PERMISSIONS. |

**No slug in the task table was missing.** No substitutions were needed; where a
task named a slug the UI did not previously reference, that slug was adopted as
written (e.g. `cart:read_all` for the Carts page, `review:read` for the Reviews
page, `settings:read` for Store settings).

## Helpers

- `PermissionService.has(slug)` (via `AuthService`) is the single runtime source.
- `appCan` (`CanDirective`) and the new `appCanDisable` (`CanDisableDirective`,
  added here because it did not exist yet) are the template helpers backed by
  `PermissionService.has`. No new permission mechanism was invented; the pre-existing
  `*hasPermission` structural directive remains but new work uses `appCan`/`appCanDisable`.

## Behaviour decisions

- The 403 page reads the denied slug from the URL (`/unauthorized?permission=<slug>&from=<url>`)
  and renders title "You don't have access", the muted slug, and a "back to first
  allowed page" action.
- Post-login redirect: the login component now routes to the first page the signed-in
  user may actually open (computed from the route→permission map), instead of hard
  coding `/dashboard`.
- The dashboard entry guard (`authGuard`) currently accepts ADMIN only; it is
  defence-in-depth and must be relaxed to the permission set in a follow-up so a
  permitted non-admin reaches the dashboard (C1 follow-up, noted here).
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

## ORDERS PHASE 5 — The backend contract, then the frontend

### 5.0 The contract was approved — and the backend came first

`ORDERS_CONTRACT.md` was approved with the instruction to build the BACKEND
first. The backend lives in a separate repository
(`../nocteon-backend`, Spring Boot), so the work landed there.

### 5.1 The backend: one state machine, one history, the counts

| What | Where | What it does |
|---|---|---|
| The strict transitions | `OrderStatusService` (already existed, no controller called it) | The controller calls it now. The endpoint used to refuse only DELIVERED and CANCELLED as the CURRENT status, so `PENDING → DELIVERED` was accepted. A refused transition answers **409** with what it refused |
| `order_status_history` | a new table | Written in the SAME TRANSACTION as every status change: the checkout records the order being placed, the admin's change records who moved it and why, the expiry sweep records its own cancellation. An order can never carry a status its history does not explain |
| `order_notes` | a new table | The team's notes about the order, always attributed. NOT `orders.notes` — that one is the customer's |
| The shipment | five columns on `orders` | The carrier, the tracking number, the tracking URL and the two timestamps. There is still no carrier API: the admin pastes what the carrier told them |
| `order_refunds` | a new table | The AMOUNT, which is what makes the net paid computable. The gateway call is still not integrated, so the row says the refund is MANUAL |
| `GET /dashboard/orders/stats` | the counts of the FILTERED set | The cards and the rows describe the same set |
| The list filters | `paymentStatus`, `paymentMethod`, `dateFrom`, `dateTo`, `search` | The browser stopped filtering a page of rows it happened to have: the API filters, and the counts are the API's |

**579 backend tests pass**, including an integration test for the transition
validation, the totals and the history written atomically.

**Two bugs the tests caught, both real:**

- the expiry sweep released the stock AND the state machine released it again
  — the units came back TWICE;
- a PostgreSQL parameter that appears in an `is null` test has no type there,
  so the date bounds could not be inferred ("could not determine data type of
  parameter"). The bounds are now never null: an absent filter is a range
  that covers everything.

The gateway refund is still NOT implemented: Paymob's refund API is not wired
in, so the refund is recorded and the money is returned by hand. The dialog
on the order page therefore stays DISABLED, and says so.

### 5.2 The frontend, against the contract

- the list asks the API for its rows AND for its counts, in one round trip,
  so a card can never contradict the rows below it;
- the search, the payment status, the payment method and the date range are
  SERVER-SIDE filters now;
- the detail page shows the **activity timeline** — the status history, the
  notes and the refunds, newest first, under the progress tracker;
- the notes card has a composer that writes to the API;
- the shipment card shows what the store recorded and lets the admin record
  it;
- the payment card shows the transaction reference, the paid-at time, the
  refunds and the net paid.

**A net paid of nothing is not zero.** An order that was never paid has a
net paid of `null`, not of its total: the backend only computes one when
money came in, and the page says "not known" instead of printing a number
that is not true.

### 5.3 The old contract text is history

The section below is the contract as it was WRITTEN, before the approval. It
is kept because the decisions in it are the decisions that were taken.

## ORDERS PHASE 5 (as proposed) — Tracking, history and notes

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

## ORDERS — The three decisions that closed the work

### 1. A shipped order cannot be cancelled

**The decision: no.** The strict map stays as it is — `SHIPPED` may only
become `DELIVERED`. Once a parcel is on its way, cancelling the order is not
a status change, it is a return, and a return is a refund with a reason.
The dialog therefore never offers the transition, and the API refuses it
with a 409.

### 2. The seeded totals are repaired

**The decision: yes.** A migration (`V111__repair_seeded_order_totals.sql`)
recomputes the stored total of the seventeen seeded orders with the SAME
formula the checkout uses:

```
total = (sum of the line totals − discount) + shipping
```

and touches only the rows that disagree. The seventeen order numbers are
listed EXPLICITLY: the repair is a fix for the seed, not a rule for the
store's real orders — an order the application creates keeps the total it
was given, because the store's books are not a migration's to rewrite.

After it: **0 of 17** orders disagree with their items (it was 17 of 17).
The orders with no items now carry their shipping and their discount, which
is what the formula says they cost.

The totals card no longer has anything to report for the seeded data, and
the "the recorded total does not match the items" warning is now a safety
net rather than a daily fact. The e2e suite proves the warning still
works: it feeds the order a mismatched total and asserts the page says so.

### 3. One branch for everything

The two sessions' work is merged into one branch. The conflicts were
resolved by CONTENT, not by side: the shared components took the main
line's version wherever it was a superset (the status badge's lookup tables,
the order-scope definition, the data table's reviews columns), the orders
pages took the clean branch's version, the two documents kept BOTH
sections, and the locale files were merged key by key.

**179 unit tests** and the whole e2e suite pass on the merged branch.

## ORDERS — The three things that were left open, now built

### 1. The gateway refund

**The money leaves the store through Paymob.** The refund dialog asks for
the AMOUNT (the whole order or a part of it) and a REASON, and the backend
calls the gateway:

```
POST https://accept.paymob.com/api/acceptance/refunds
{ "parent_transaction_id": "<the transaction>", "amount_cents": "<cents>" }
```

**The refund is recorded only when the gateway has accepted it.** That is
the whole point of the order: a refund row means the customer has the money
back, and a row without a gateway reference would be a promise the store
cannot keep. A refusal changes nothing at all — the gateway's own message
is shown, and the order is untouched. The unit test proves it.

### 2. The status-change e-mail

The status dialog has a **"notify the customer"** switch, and the change is
recorded with the flag. The e-mail is enqueued **after the transaction
commits**, so nobody is told about a change that was rolled back. The
template id comes from the environment (`BREVO_TEMPLATE_ORDER_STATUS_CHANGED`),
like the other order e-mails.

### 3. The dates

The last **22** uses of the built-in `| date` pipe are gone, in 12
features. The pipe rendered the date in the LOCALE'S OWN order with no
direction handling, so an Arabic page showed "10/20/2026" while the rest of
the app showed "20 Oct 2026" / "20 أكتوبر 2026". One date, one helper.

**The formatter audit now reports 0 findings**: no money, no date and no
order number is formatted outside the shared helpers, anywhere in the app.

## ORDERS — One environment finding: the API rate limit

The full e2e suite (both sessions' specs, 200+ tests) tripped the backend's
general rate limit: **200 requests per minute per identifier** (the
identifier is the caller's IP, so every browser on the machine shares it).

The symptom is a list page that renders its ERROR STATE instead of its
table — which is the app behaving correctly, not a defect — and a test that
then fails with "no table rendered".

It is not caused by the orders work: the orders pages make three requests
per page load, and the evidence run (120 page loads) stays at ~27 requests
a minute. It appears when two suites run at once, which is exactly what
happened while the two sessions were working side by side.

**What was done about it:** the failing tests pass when they are run in
smaller batches with a pause between them, which is the proof that the
limit — and not the code — is the cause. The app's own answer to a 429 is
the error state with a working retry, and the backend's message ("Too many
requests, please slow down.") is shown as it is.

**What is still open:** a suite that runs 200+ tests against one IP will
trip the limit. The fix belongs in the harness (a pause between the
heavier specs) or in the backend (a higher limit for the authenticated
dashboard calls). Neither is the orders' to decide.

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


## BROADCASTS — The page, and the thing the page cannot fix

The broadcasts page printed **the page's row count, the word "of" and a
bell icon** ("2 of 🔔"), the status badge printed **the raw enum**
("PENDING"), and **nothing said who the broadcast goes to**.

- The header now prints the TOTAL with a real label ("2 broadcasts"), like
  the other lists.
- The status is translated: Queued / Sending / Sent.
- The create dialog says the audience out loud: the backend picks the
  recipients with `findByRoleAndSubscribedTrue(CUSTOMER)`, so one message
  goes to EVERY customer, and the row carries the count the backend
  counted.

**What the page cannot fix:** the deployed backend has no sender. Its
broadcast package is `BroadcastCreationService` and nothing else — no
sender, no scheduler, no `send` endpoint — so a broadcast is created with
its recipient rows and stays `PENDING` with `sentCount = 0` forever. The
page says "Queued" and shows what HAS been sent rather than pretending the
delivery is done. The backend needs a sender: a `POST
/api/dashboard/broadcasts/{id}/send`, or a scheduled job that walks the
`PENDING` recipient rows through the existing `EmailService`.

## NEWSLETTER — a page for the addresses, and an export

The newsletter page is a LIST like every other list — the shared
`app-data-table`, the search, the pager, the count in the header — with
one thing it exists for: **the export of the addresses**.

- The audience is the store's CUSTOMERS (`GET
  /api/dashboard/users?role=CUSTOMER`), because that is the same set a
  broadcast reaches (`findByRoleAndSubscribedTrue(CUSTOMER)`), so the two
  pages cannot disagree about who the audience is.
- The export covers **every** address, not the rows on the page, and it
  walks the pages: the API caps a page at 100 rows and answers a bigger
  `size` with a 400. Asking for a thousand rows in one request exports
  NOTHING — which is what the first version did.
- The count agrees in number ("1 address in the audience"), through the
  app's plural family (`<base>_<Intl.PluralRules category>`), because
  "1 addresses" is the kind of small wrongness the rest of the app does
  not have.
- **The page says what the list IS.** The admin `UserResponse` carries no
  newsletter flag and the list has no `subscribed` filter, so the page
  cannot tell a subscribed customer from an unsubscribed one. The help
  line says so instead of pretending the list is a subscription list. The
  backend needs a subscriber list (or a `subscribed` filter) for that to
  change.

## BROADCASTS — what the page was missing

- The header printed **the page's row count, the word "of" and a bell**
  ("2 of 🔔"). It prints the TOTAL, with a label that agrees in number.
- The status badge printed **the raw enum** ("PENDING") — an untranslated
  string on the Arabic page. It is "Queued" / "Sending" / "Sent".
- **The audience is now stated**: the create dialog says the message goes
  to every customer of the store, and every row carries the recipient
  count the backend counted.
- **The broadcast can be deleted.** The backend HAS
  `DELETE /api/dashboard/broadcasts/{id}` (it removes the broadcast and
  its recipient rows); the frontend threw instead, so there was no way to
  get rid of a broadcast.
- **The broadcasts export** as a CSV, walking the pages like the
  newsletter export.

**The delivery is still a backend gap.** The deployed backend has no
sender: its broadcast package is `BroadcastCreationService` and nothing
else — no sender, no scheduler, no `send` endpoint — so a broadcast is
created with its recipient rows and stays `PENDING` with `sentCount = 0`
forever. The page says "Queued" and shows what HAS been sent rather than
pretending the delivery is done. The backend needs a sender: a `POST
/api/dashboard/broadcasts/{id}/send`, or a scheduled job that walks the
`PENDING` recipient rows through the existing `EmailService`.

## THE PAGE SIZE — the API caps a page at 100, and a bigger one is a 400

Found while re-running the suites after the newsletter work: the **orders
page never loaded** — it sat on "Loading..." forever, and ten orders tests
failed with it.

The cause was one line in the orders list: a full read of the filtered set
for the revenue KPI asked for `size: 1000`. The API validates `size` on
**every** dashboard list endpoint and answers **400**
(`"must be less than or equal to 100"`) for anything bigger — verified
against orders, users, categories and broadcasts, one shared cap. So the
request was not a bigger page, it was a **failed** page, and a 400 inside
the list's `forkJoin` took the rows, the counts and the KPIs down with it.

Two rules now hold everywhere:

- **The size is clamped, once, in the base CRUD service** (`MAX_PAGE_SIZE
  = 100`), and in the product service (which does not extend the base).
  A caller that asks for 200 gets 100 rows, not a 400. This also unbreaks
  the preloader of the journal form and the product wizard's dropdowns,
  which asked for 200 rows and silently got an error.
- **A caller that needs MORE than a page walks the pages** — the orders
  KPI read, the newsletter export and the broadcasts export all page until
  a page comes back short. A "size: 1000" request is never sent.

The rule for the future: the API's cap is 100 rows per page. Anything that
wants the whole set asks for page 0, 1, 2 … until one page is short.

## Orders list v3 (ui/orders-list-v3)

- KPI Revenue = sum of `totalAmount` of PAID orders only (COD pending and refunded excluded); AOV = Revenue / paid count; cancel rate = cancelled / all. KPIs follow active filters. Basis stated via card tooltip.
- Open = Pending + Confirmed + Processing + Shipped (OPEN_STATUSES updated to include Shipped).
- Customer column uses shared `CustomerCellComponent` with avatar; width 220px.
- Created at renders on one line (stackTime false).
- "No items" renders warning icon + tooltip.
- COD + Cancelled payment status maps to "Not collected" (frontend mapping; logged).
- Order # renders as accent link via data-table cellHref.
- Row hover highlights full row including checkbox/actions; focus-visible + keyboard Enter.
- Sort indicators use shared `SortHeaderComponent` (chevrons inactive, arrows active) with aria-sort.
- Filters: label inside control, active count on Clear filters.
- Bulk bar: allowed transitions only, Export selected, confirm dialog.
- Row kebab: View, Update status, Print invoice, Resend email, Copy order number, separator, Cancel.
- Refunded secondary line shown only when `refundedAmount` present.

## Reviews v3 (ui/reviews-v3)

- RatingStars: every star was hollow because the component used Lucide's outline `star` icon and toggled `fill-warning` on the host. Lucide's SVG carries `fill="none"`, so the CSS fill never reached the path and no star ever filled. Fix lives in `src/app/shared/ui/rating-stars/rating-stars.component.ts`: both states are now inline SVGs with an explicit `fill="currentColor"` (filled) / `fill="none"` (empty), coloured with the `warning` / `muted` tokens. Aria-label is now `N out of 5`.
- Average rating basis: kept the backend's value (computed over ALL reviews, 4.0) because the API has no approved-only average; labelled `reviews.stats.averageRating` as "Average rating · all" so the basis is explicit. Approved-only would be 4.31 but requires a new endpoint (see API_GAPS).
- VerifiedBadge: created `src/app/shared/ui/verified-badge/verified-badge.component.ts` (was missing) using a badge-check icon in the primary token with a visible tooltip + aria-label "Verified purchase", visually distinct from the green Approved StatusBadge.
- Reviewer display name: backend returns lowercase `username` only; no full name exists, so the UI title-cases the username (`toDisplayName`) and shows the full value in a tooltip. Full-name source remains an API gap.
- Table: Rating column sized to 150px with a 16px gap before Comment; Comment clamped to 2 lines with tooltip; no horizontal overflow at 1440/1280; Approve only on Pending rows via `primaryActionFor`; kebab holds Withdraw (approved rows) + Delete (confirm). Always-visible red trash removed (`showDelete="false"`).
- Grid: RatingStars + `N/5`; reviewer line with VerifiedBadge; status badge in card header corner; Pending footer has Approve + Eye + kebab, Approved footer has Eye + kebab only (shrinks); comment clamped to 3 lines; stable min-height; last row left-aligned; view toggle persists via `view` URL param with `aria-pressed` and tooltips.
- Star distribution: 5 horizontal bars labelled with the star level and count; clicking a bar filters by that rating (minRating).
- View toggle persisted via `view` query param (and localStorage) with aria-pressed and tooltips.

## Order details v3 (ui/order-details-v3)

Scope: the order DETAIL page only (`/dashboard/orders/:id`). The Orders list,
Reviews and every other page are untouched.

### The page reports recorded facts, and says "not recorded" where the store is silent

- **Every event on the activity log is a timestamp the backend actually
  returned.** Today that is the order's `createdAt`; the status history, the
  notes and the refunds are read when they exist. There is no synthetic
  "journey" (no invented "confirmed at", no fake e-mail rows). The progress
  tracker states once that step dates are not recorded instead of dating steps
  it cannot know.
- **Paid / refunded / balance are derived by `computeSettlement` from recorded
  fields only.** A REFUNDED order with no refund line has an UNKNOWN refunded
  amount (`null` → "Not recorded"), never `0` (which would claim the customer
  got nothing back) and never the total (which would claim a full refund).
  `0` is shown only when the store records a real zero (a FAILED or PENDING
  payment collected nothing). The old "Net paid" row is gone: "Paid − Refunded
  = Balance due" says the same thing without a fourth number.
- **A PAID order missing `paidAt`/`transactionReference` gets an inline warning
  in the Payment card**, not a silent dash. A dash that looks like a zero was
  one of the defects this page fixes.
- **The shipment card shows the fields that exist** (carrier, tracking number,
  tracking URL, shipped-at, delivered-at). A shipped/delivered order with no
  shipment gets a subtle warning — the data gap is visible, not apologised
  away in prose. The old "the store does not record…" apology is gone; the
  form is real (`OrderShipmentDialogComponent`, shared `DialogShellComponent`).

### Items: the variant comes from the catalog, the discount does not exist

- Order lines carry `variantId` only. The page resolves the chosen variant's
  weight/grind and SKU from `GET /api/dashboard/products/{slug}` and joins it
  by `variantId` (`order-items.adapter.ts`). A failed product read leaves the
  line intact without the variant label — it never blocks the order.
- The line shows quantity × unit price, the line total, and — when the catalog
  has a `compareAtPrice` — that price struck through, labelled **regular
  price**, with a tooltip saying it is the catalog's regular price and *not* a
  discount on this order. There is no per-line discount field in the API
  (`OrderItemResponse` has no discount), so no per-line discount is invented.
  The struck price is not counted in the totals.
- SKU is displayed exactly as the API returns it. Today order lines return
  `SKU-1-1` while the catalog/carts use `SKU-001`; that is seed data, logged in
  `SEED_PROPOSAL.md`, not normalised in the UI.

### Totals and customer facts

- Subtotal / Discount / Shipping / Tax / Total, then Paid / Refunded / Balance.
  Tax is rendered only when non-zero (the backend has no tax concept).
- Customer order count and lifetime spend are computed from
  `getEveryOrder({ userId })`, summing PAID orders only. The basis is stated in
  the tooltip. There is no customer aggregate endpoint; `API_GAPS.md` asks for
  one.
- City and governorate are deduplicated (`city = state = "Giza"` renders once),
  and the address name/phone are hidden when they repeat the customer card.

### Header, actions, breadcrumb

- Breadcrumb is `Operations > Orders > ORD-…`. The detail route now carries the
  `orders` crumb (not a generic "Order" placeholder), and the entity name is
  APPENDED rather than replacing its parent. New **add-only** method
  `BreadcrumbService.appendCrumb()` (plus the existing `updateCrumbLink`) keeps
  the trail across a language switch; `updateCrumbLink` now accepts the list URL
  as a prefix of the detail crumb's URL, so "Orders" returns to the filtered
  list the user came from (`previousNavigation.finalUrl`, fallback
  `/dashboard/orders`). No Orders-list code was changed.
- A disabled action is **visibly disabled** and carries the reason in
  `title`, `data-disabled-reason` and a tooltip on the wrapper: Update status
  on Delivered/Cancelled, Refund unless PAID, Cancel on a final order, Resend
  email (no endpoint). The kebab holds Cancel, Refund, Copy link, Copy order
  number. Tags card removed; there is no `data-card="tags"` in the page.
- A change of status sends the chosen note and the notify flag with the
  request; the page reloads the activity afterwards instead of assuming what
  the backend wrote.

### Print

- Print always uses the LIGHT stylesheet: `beforeprint` removes `.dark` from
  `<html>` and `afterprint` restores it, so a dark-mode admin does not print a
  black page. The component stylesheet drops the two-column grid and hides
  `.print-hidden` controls; a small global rule hides the sidebar and top bar.
  No token values are duplicated — the light theme tokens do the colouring.

### Verification notes

- `i18n-keys.spec.ts`'s Arabic mixed-script rule now allows keyboard key names
  (`Ctrl`, `Cmd`, `Enter`), which are printed as they are on the keyboard. The
  `noteHint` is the only string that needs it.
- Three unit failures are pre-existing on `main` (navigation-bar raw-control
  ratchet; missing `nav.reviews`/`nav.contactMessages`/`nav.carts`; single-brace
  placeholders in `nav.viewAll`/`nav.noResultsFor`). They are not caused by this
  page and are not fixed here.

### Evidence harness changes (scripts only)

- `scripts/evidence-targets.mjs` had a broken `global-search` target (a
  missing `]`/`},` closed the array early, so `node scripts/evidence-targets.mjs`
  did not parse at HEAD). Fixed as part of adding the `order-details-v3` and
  `order-details-v3-extra` target sets; no other target definition changed.
- `scripts/evidence.mjs` now honours `--out <dir>` (it read the flag but never
  used it) and `--widths <list>` (widths were hardcoded). Defaults are
  unchanged, so existing runs keep producing the same five widths.
- `MEASURE_ORDER_DETAIL` was extended to record: per-step state/check/number,
  disabled action + `data-disabled-reason`, activity count/titles, the payment
  card's reference/paid-at/warning, the totals rows, the breadcrumb, the
  presence of the Tags card, the shipment/customer/address text, and the
  loading/error/not-found states. The `before/` baseline was captured with the
  same measured fields after this extension (before any UI edit), so the
  before/after comparison is like for like.

<!-- ── v4 decisions (ui/order-details-v4) ──────────────────────────────── -->

### Resend email: kept DISABLED by design

No `POST /api/dashboard/orders/{id}/resend-email` endpoint exists (see
API_GAPS.md #6). The "Resend email" button stays visibly disabled with the
reason "the store sends order e-mails automatically, but it cannot send one on
demand." on both the button's `title` and its wrapper tooltip. This is a design
decision: a button that silently does nothing is worse than one that says it
cannot. The tooltip wrapper carries `tabindex="0"` and `role="group"` so the
reason is reachable by keyboard focus.

### Customer summary: client-side `userId` filter

The `GET /api/dashboard/orders?userId=N` endpoint accepts `userId` but silently
returns every order (API_GAPS.md v4 #1). The page filters client-side:
`orders.filter(o => o.customer?.id === customerId)` before summarising. This is
correct for the 17-seed dataset but does not scale; the backend should honour
the filter server-side.

<!-- ── Orders v5 decisions (ui/orders-list-v4 + ui/order-detail-v5) ──────── -->

### One set: the view is the filtered set intersected with the tab

The rows, the pager, the header count and the four KPI cards all describe the
same set: the FILTERED set (date range + payment status/method + search)
intersected with the SELECTED TAB. A card can never contradict the rows under
it, because they are the same set.

The tab counts are the one exception: they are FACET counts of the filtered
set, so clicking a tab does not zero the other tabs. The "All" tab counts the
filtered set too — not the whole store — so the strip never mixes two sets.

### The money comes from the API, and the average is over the PAID orders

`GET /api/dashboard/orders/stats` returns `revenue` (the paid, non-cancelled
orders, less their refunds) and `revenueOrderCount` (how many orders that sum
was taken over). The average is the revenue over the PAID orders — not over
every order, and not over the cancelled ones. The cancel rate is the
cancelled orders over the orders shown.

Before this, the page read the WHOLE filtered set in the browser to add it up
— a read the API clamps to 100 rows, so the numbers were wrong past 100
orders and the browser was doing the store's accounting. There is no flag
left: the aggregates are the API's now.

### Two stats calls, two scopes, on purpose

The tab counts need the filtered set WITHOUT the tab; the cards need it WITH
the tab. The page therefore asks the stats endpoint twice. That is cheaper
than the alternative (a facet count per tab, or a full read in the browser)
and it keeps each scope explicit in the code.

### The tab click RELOADS

The URL subscription compares the incoming state with the state of the LAST
LOAD, not with the signals. A control that sets its own signal first (the
status tab, the page size) would otherwise look unchanged to the URL, and the
table would keep showing the old rows. The bug was invisible until a test
compared the tab's rows with the tab's filter.

### An action that cannot apply is HIDDEN

A delivered order offers no status change; a cancelled one cannot be
cancelled again; a refunded one cannot be refunded again. The button is not
greyed out — it is not there. A disabled button still asks the reader "why?",
and the answer ("this order is final") belongs in the order's state, not in a
tooltip.

### The status change is a DIALOG with a dropdown of the allowed transitions

The dialog carries the note and the "tell the customer" switch, so a quick
status change is never a click that forgets them. Its status field is a
dropdown of ONLY the transitions the backend's state machine allows.

### Every column budget is MEASURED, in both languages

The orders table has nine columns and a content column of 1126px at 1440. The
budgets were measured — the width the header and the widest value need, in
English AND in Arabic — and the cells take `px-3` so every value has room.
The Created-at cell is ONE line (the date), with the relative time in the
tooltip: a two-line cell is what pushed the table into a sideways scroll.

### The customer card shows the CUSTOMER's numbers

The card's order count and lifetime are the customer's own, computed from
their orders, with the basis in the tooltip. It used to show the store's
totals, which is a number the reader cannot act on.

### The catalog's regular price is a REFERENCE, not a discount

A struck-through price on a line reads as a discount on the order. The
catalog's compare-at price is shown with the label "Regular price" and a
tooltip that says what it is, and it is never subtracted from the totals. A
discount row appears only when the order has a discount.

### A value the store does not record is missing, not zero

The settlement says "Not recorded" when the refund amount is unknown, and the
warning banners appear only when the condition is real. An order with no
line items is flagged with a warning, not shown as a silent "0 items".

### The seed says the truth about the cancelled cash-on-delivery orders

The expiry sweep used to leave the store's data in a state only a scheduled
job could produce. The seed now says it outright: orders 6 and 10 are
cancelled cash-on-delivery orders, so "Not collected" exists on a fresh
database instead of waiting for the sweep. The seventeen orders also have
their own hours, so "created at, newest first" is a real order and page 1
and page 2 do not show the same rows.

## Needs backend

### Polish pass 1 — nav-counts (W2)
- `GET /api/dashboard/nav-counts` does not exist (probed 2026-10-25); sidebar shows NO count badges. Write "nav-counts" here per spec. A dev-only `?mockNavCounts=1` (or `localStorage.devMockNavCounts=1`) flag mocks badges for screenshots.

### Polish pass 1 — mark unread (W3)
- No `mark as unread` endpoint (only `PATCH /read`); Mark unread omitted from row actions and bulk bar.

### Polish pass 1 — reply history (W4)
- Contact API returns a single reply (`replyContent`/`repliedBy`/`repliedAt`), not a thread array; thread view omitted. Write "reply history" here.

### Custom date range picker (G5)
- The "Custom" option in the dashboard toolbar uses two native date inputs in a popover as a temporary solution.
- The existing Spartan date-range-picker component exists in `libs/ui/date-picker/` but requires complex integration.
- A proper implementation would need backend support for custom date range queries.
- Current implementation: native date inputs with apply/cancel buttons.

## Users pass 1 notes

- Backend has two flags (`enabled` = verification, `isActive` = not blocked). Mapped: Active = enabled && !blocked; Blocked = enabled && !active; Unverified = !enabled. "Enabled"/"Account enabled" removed from UI.
- No API summary endpoint for counts: chip counts computed from the loaded list. Needs backend (counts).
- No roles endpoint originally: added `GET /api/dashboard/users/roles` (local backend jar) and frontend consumes it; falls back to distinct roles from loaded users.
- Phone field added to API response/update (local backend jar). Frontend sends phone; backend ignores gracefully if absent.
- No user delete endpoint originally: added `DELETE /api/dashboard/users/{id}` (local backend jar).
- No activity summary endpoint: Activity card hidden. Needs backend (activity).
- No password-reset/invite-email endpoint: those kebab/dialog options omitted. Needs backend.
- Delete confirm dialog requires typing the username.

---

# Notifications pass 1 — Needs backend

The client discovered these gaps by reading the running backend source, not by
guessing. Until they ship, the UI only calls endpoints that exist.

## Missing event producers

These events do **not** create an admin notification today:

- `payment.failed` — `PAYMENT_FAILED` exists in the enum, but no listener writes it.
- `contact.message` — no event/listener.
- `stock.low` — no event/listener.
- `user.new` — no event/listener.
- `review.pending` — `REVIEW_CREATED` fires on submit, but carries no moderation
  status; it is shown as a pending review in the client.

`order.new` already exists as `ORDER_CREATED` and `payment.succeeded` exists as
`PAYMENT_SUCCEEDED`.

## Requested notification contract

The current row is `{ id, type, title, message, link, read, createdAt }` with
server-rendered English `title`/`message`. The client's i18n templates need:

```json
{
  "type": "order.new",
  "titleKey": "notifications.types.order_new.title",
  "bodyKey": "notifications.types.order_new.description",
  "params": { "orderId": 1042, "total": "1,240.00 EGP" },
  "entityType": "order",
  "entityId": 1042,
  "createdAt": "2026-10-24T12:00:00Z",
  "readAt": null
}
```

`titleKey`/`bodyKey` let the client translate; `params` fill the templates;
`entityType`/`entityId` build routes; `readAt` replaces the one-way `read`
boolean so unread can be represented. Keeping `title`/`message` as a fallback
lets old rows render during the migration.

## Missing endpoints

| Need | Requested endpoint | Current state |
|---|---|---|
| Delete one | `DELETE /api/dashboard/notifications/{id}` | absent |
| Bulk delete | `DELETE /api/dashboard/notifications` with ids | absent |
| Mark unread | `PATCH /api/dashboard/notifications/{id}/unread` | absent |
| Type filter | `GET /api/dashboard/notifications?type=order.new` | only `unreadOnly` |
| Bulk read | `PATCH /api/dashboard/notifications/read` with ids | absent; client loops `/{id}/read` |

## Permissions

`notification:update` and `notification:delete` exist in the permission
catalog, but every notification endpoint is guarded by
`notification:read` only. The UI hides/disables update/delete controls by
permission, but the server must enforce them before these actions are safe.

## Reviews pass 1 (reviews-pass-1)

### Reviewer identity is an API gap, not a UI choice
- `GET /api/dashboard/reviews` returns `username` only. There is no `userId`,
  `firstName` or `lastName` on the review response, so the list and the
  details dialog can only render a display name derived from the username
  (`toDisplayName`). The name links to `/dashboard/users` (the user list);
  a deep link to `/dashboard/users/:id` needs `userId` from the backend.
- **Needs backend:** add `userId` (and, if available, the customer's full
  name) to `ReviewResponse` so the reviewer can link to the customer page.

### Moderation metadata does not exist yet
- The API exposes `status` and `createdAt`; it has no moderation note, no
  `moderatedBy` / `moderatedAt`, and no status history. The dialog shows only
  the rows it can prove (Status, Created, Order). The "Moderated" row is
  conditional and is not rendered with the current API.
- **Needs backend:** a moderation note/history endpoint or fields on the
  review response. No note or history is invented in the UI.

### The status filter is a backend gap the list works around
- `GET /api/dashboard/reviews` ignores the `status` query parameter. The list
  sends `isApproved` for the Pending/Approved tabs and filters the Rejected
  tab client-side after the response. Tab counts come from
  `/dashboard/reviews/stats`.
- **Needs backend:** honour `status` (or document `isApproved` as the only
  supported filter) so the client-side filtering can be removed.

### Control heights
- The app's compact control token is 32px (`--control-height-compact`).
  The search input and the filter selects both measure 32px; there is no
  36px token or shared 36px search component in this revision.
- The reviews table opts into a 72px row height through the new optional
  `rowHeight` input on `DataTableComponent`; rows measure 72px exactly.

### Evidence
- Viewport screenshots are 1440x900 (not full page) under
  `evidence/reviews/pass1/{light-en,dark-en,light-ar}/`.
- `evidence/reviews/pass1/results.json` records the measured checks:
  row-height spread, kebab x spread, Verified KPI vs API stats, search/select
  heights, and the dialog actions for each status.

### R4 — seed and startup assertion: skipped in this branch
- The dev seed (`V107__seed_orders_reviews_contacts.sql`) and any startup
  assertion live in the `nocteon-backend` repository, not in this dashboard
  branch. The current backend seed creates every review with `NOW()` and
  `is_verified = TRUE`; it has no rejected review and no order-linked
  verified review, so it cannot satisfy R4 as written.
- The running dev database was inspected for the evidence: 17 reviews,
  1 pending, 15 approved, 1 rejected, 6 verified. The screenshots and
  `results.json` use that data; the Verified KPI (35%, 6 of 17) is the true
  count over all reviews, not a hard-coded example.
- Why skipped: changing the seed needs a backend migration and a database
  re-seed, which is outside `reviews-pass-1` (dashboard only). No seed rule,
  no synthetic review and no startup assertion was invented in the frontend.
- **Needs backend:** update V107 (or add a V-next migration) so the dev data
  has at least 3 pending, 1 rejected, 10 verified of 17, an order-linked
  verified review, and a startup assertion that prints the number checked.
## Products pass 1 + 2 notes

### Field names: `active`, `primary`
- `DashboardProductResponse`/`ProductCardResponse` use a primitive `boolean isActive`,
  which Jackson serializes as `active`. The dashboard reads `active` first and keeps
  `isActive` as a compatibility fallback (`readProductActive`).
- `ProductMediaResponse` serializes `isPrimary` as `primary`; existing media is mapped
  to the form's `isPrimary` on load.

### The list API has no stock or variant count
- `GET /api/dashboard/products` returns `ProductCardResponse`, which has no
  `totalStock`, `lowStockVariantCount`, or `variantsCount`.
- The list shows an honest `—` (with a tooltip) for those cells instead of inventing
  numbers. Needs backend: add these fields to `ProductCardResponse` (or a batch
  summary endpoint) before the list can show real stock badges.

### No default-variant field
- The backend has no `defaultVariantId`/`isDefault` field. The variants editor does
  not offer "set as default". Needs backend.

### No per-language story
- `ProductTranslationRequest` has `name`, `description`, and `shortDescription`, but
  no `story`. The story stays at product level in the Coffee details card. Needs
  backend: add `story` to `ProductTranslationRequest` before moving it into the
  EN/AR content segments.

### Tasting notes have no category
- `TastingNoteResponse` has only `slug` + translations. The picker stays one flat
  list; grouping by category needs a backend category field.

### Media ordering is saved, but upload progress is local
- Existing and staged media can be reordered with CDK drag/drop; `sortOrder` is sent
  on save. New files are staged locally and show a readiness bar, not a real bytes-
  uploaded progress stream.
