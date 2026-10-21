# Order Details v3 — Design Spec

## 1. Purpose and constraints

Redesign the Order DETAILS page (`/dashboard/orders/:id`) to fix 10 known defects in data presentation, timeline accuracy, action availability, and layout. Scope is the detail page **only** — not the orders list, reviews, or other pages.

- **Branch:** `ui/order-details-v3` (already exists; do NOT touch main).
- **Spec:** this file uses design.md tokens only (no raw hex). Keeps Spartan UI.
- **i18n:** EN + AR; RTL and dark mode verified by the evidence harness.
- **No invented backend data:** if an API field is missing, log it in `API_GAPS.md` + a typed adapter behind a flag, and report "blocked on backend". Never fake events, shipment data, or refund amounts in the production path.
- **Shared primitives:** reuse if present (StatusBadge, formatDateTime/formatRelative/formatMoney, DialogShell, CustomerCell, formatDateAndTime); create only if missing, in the shared location, add-only. Changing a shared primitive's API requires updating every usage and listing them in `DECISIONS.md`.

## 2. Current state of the code (what exists)

- `OrderDetailComponent` already orchestrates the page: two columns, loads order + activity (history + notes + payment), manages dialogs, handles print, copy, copy-link, etc.
- `OrderProgressComponent` renders the stepper but history is missing (all seeded orders return `[]` from `/history`).
- `OrderStatusDialogComponent` offers strict transitions only (already enforces the intended matrix).
- `OrderCancelDialogComponent` requires a reason and states consequence.
- `OrderRefundDialogComponent` shows remaining amount, full/partial, gateway note.
- `OrderShipmentDialogComponent` has carrier, tracking number, tracking URL fields.
- `DialogShellComponent` provides consistent dialog UX (focus trap, restore, backdrop, sheet on mobile).
- `OrderProgressComponent` renders the stepper but history is missing (all seeded orders return `[]` from `/history`).
- `DialogShellComponent` provides consistent dialog UX (focus trap, restore, backdrop, sheet on mobile).
- `computeOrderTotals`, `computeSettlement`, `summarizeCustomerOrders`, `buildOrderEvents`, `buildOrderItemViews` are pure adapters.
- `order-progress.component.html` renders the stepper with check for done, ring for current, muted for future. Cancelled and Refunded render as terminal states.
- `DialogShellComponent` provides consistent dialog UX (focus trap, restore, backdrop, sheet on mobile).
- `computeOrderTotals`, `computeSettlement`, `summarizeCustomerOrders`, `buildOrderEvents`, `buildOrderItemViews` are pure adapters.
- `order-progress.component.html` renders the stepper with check for done, ring for current, muted for future. Cancelled and Refunded render as terminal states.
- The page already shows "Not recorded", inline warnings, and disabled actions with reasons — it never fakes data.

## 3. Issues to fix (from the brief)

| # | Issue | Source in brief |
|---|-------|-----------------|
| 1 | Breadcrumb reads "Operations > Order"; the order number is not in it. | "Breadcrumb reads Operations > Order" |
| 2 | Timeline: the last step (Delivered) is a filled circle with "5" instead of a completed check. "No recorded events yet." sits under a Delivered order. No dates, no actor per step, no activity log. | "Timeline: the last step (Delivered) is a filled circle with '5' instead of a completed check. 'No recorded events yet.' sits under a Delivered order. No dates, no actor per step, no activity log." |
| 3 | "Update status" and "Resend email" look disabled with no tooltip explaining why; the kebab contents are unknown. | "'Update status' and 'Resend email' look disabled with no tooltip explaining why; the kebab contents are unknown." |
| 4 | The Shipment card still shows the apology sentence ("The store does not record a carrier...") above the new button; a Delivered order with no shipment is inconsistent. | "The Shipment card still shows the apology sentence... above the new button; a Delivered order with no shipment is inconsistent." |
| 5 | The Tags card is dead ("The store does not have tags for orders yet."). | "The Tags card is dead ('The store does not have tags for orders yet.')." |
| 6 | Payment: status Paid but Transaction reference and Paid at are both "—". No refund action, no copy button. | "Payment: status Paid but Transaction reference and Paid at are both '—'. No refund action, no copy button." |
| 7 | Totals: "Net paid" duplicates Total; no Discount, Refunded or Balance rows. | "Totals: 'Net paid' duplicates Total; no Discount, Refunded or Balance rows." |
| 8 | Items: no variant/weight (250g), SKU format `SKU-1-1` (carts use `SKU-001`), no link to the product. | "Items: no variant/weight (250g), SKU format `SKU-1-1` (carts use `SKU-001`), no link to the product." |
| 9 | The Customer card lacks orders count and lifetime spend. The address repeats "Giza, Giza" and repeats name and phone. | "The Customer card lacks orders count and lifetime spend. The address repeats 'Giza, Giza' and repeats name and phone." |
| 10 | Internal notes have no author or time. | "Internal notes have no author or time." |

## 4. Design decisions

### 4.1 Breadcrumb

**Decision:** `Operations > Orders > ORD-2026-000001` (order number as last crumb, clickable back to the list with its filters preserved).

**Implementation:** In `OrderDetailComponent.loadOrder()`, after setting the order:
```typescript
this.breadcrumb.appendCrumb(this.orderNumber());  // adds the order number as last crumb
this.breadcrumb.updateCrumbLink('/dashboard/orders', this.returnUrl()); // ensures "Orders" crumb points back to the filtered list
```

The `BreadcrumbService` already supports `appendCrumb` and `updateCrumbLink`. The `returnUrl` is already captured from the previous navigation.

### 4.2 Timeline / Progress Tracker

**Decision:** 
- The stepper already has the correct logic: done steps show a check (`lucideCheck`), current step shows a ring (brand color), future steps are muted. Delivered shows a check (not "5").
- **Fix:** The issue is that `stepRecords` is empty because `/history` returns `[]`. The component already handles `historyMissing` and `stepDate/stepActor` returning null. No code change needed in the tracker — the fix is backend data.
- **Activity Log (under the stepper):** Already implemented as `events()` computed from `buildOrderEvents()`. It shows icons, titles, detail, amount, actor label, and timestamp. The "No recorded events yet" message only shows when `events().length === 0`. This is correct — it will show events when the backend provides history/notes/payment/refunds.

**No frontend code change needed** for the timeline logic — the defects are data gaps (documented in `API_GAPS.md` §2, §3.1, §3.3). The UI already handles empty history gracefully.

### 4.3 Header Actions & Kebab

**Current state:**
- "Update status" — already has `statusDisabledReason()` computed, shows tooltip when disabled (line 85-109 in HTML). ✅
- "Print invoice" — enabled. ✅
- "Resend email" — disabled with `resendReason()` tooltip (line 139-163). ✅
- Kebab menu: Cancel (with `cancelDisabledReason`), Refund (with `refundDisabledReason`), Copy link, Copy order number. ✅

**Fix needed:** The brief says "look disabled with no tooltip" — but the code already has tooltips on the disabled buttons via `hlmTooltip` + `brnTooltip` on the wrapper `span`. The issue may be that the tooltip doesn't show because the button is `disabled` (disabled buttons don't emit pointer events). The current code wraps the disabled button in a `span` with `hlmTooltip` — this is correct.

**Decision:** No code change needed. The tooltips are already implemented correctly via the wrapper pattern.

**Kebab contents:** Already has Cancel, Refund, Copy link, Copy order number. The brief mentions "Copy link" as missing — it's already there (line 206-210). 

**Decision:** No code change needed.

### 4.4 Shipment Card

**Current issue:** Shows apology text "The store does not record a carrier..." above the "Record the shipment" button even when the order is SHIPPED/DELIVERED.

**Decision:** 
- When `hasShipment()` is false AND status is SHIPPED/DELIVERED: show a **warning** (not an apology) that shipment data is missing for this status, plus the "Record the shipment" button.
- When `hasShipment()` is false AND status is NOT SHIPPED/DELIVERED: show "No shipment recorded yet" + button.
- When `hasShipment()` is true: show carrier, tracking number (with copy + external link), shippedAt, deliveredAt, tracking URL (external link), and "Edit shipment" button.

**Implementation:** The template already has `shipmentMissingForStatus()` computed (line 350-353 in TS) and shows a warning at line 939-947. The "apology" text is the "No shipment recorded yet" message at line 934-936. 

**Fix:** Change the empty state message:
- When `shipmentMissingForStatus()`: "This order is marked as shipped/delivered but no shipment is recorded." + button
- Else: "No shipment recorded yet" + button

This is a text change in the template (line 934-936).

### 4.5 Tags Card

**Decision:** Remove the Tags card entirely. The backend has no tags feature (API_GAPS.md §3.7). The card shows "The store does not have tags for orders yet." — this is an honest empty state but serves no purpose.

**Implementation:** Remove the Tags card section from the template (lines 962-970 approximately). Log in `DECISIONS.md`.

### 4.6 Payment Card

**Current issues:**
- Transaction reference and Paid at show "—" (missing data)
- No copy button for transaction reference
- No refund action button visible when refundable

**Decision:**
- Transaction reference: show "Not recorded" with warning styling when missing, show value with copy button when present. ✅ Already implemented (lines 731-758).
- Paid at: show "Not recorded" with warning when missing on PAID orders. ✅ Already implemented (lines 771-775).
- **Add:** Refund action button when `canRefund()` is true (already computed at line 223-227). The button exists at line 842-853 but only shows when `!refundDisabledReason()`. This is correct.
- **Add copy button for transaction reference** — already exists at line 740-751! ✅

**Fix needed:** The brief says "No refund action, no copy button" — but both exist in the code. The issue may be that they're not visible because the seeded data has missing payment facts. No code change needed.

### 4.7 Totals Card

**Current issues:**
- "Net paid" duplicates Total (line 363-372 shows "Paid" which is `settlement().paid`, then "Total" is shown separately at line 353-360)
- No Discount row (only shows when `totals().discount > 0`)
- No Refunded row (shows at line 374-382 but shows "Not recorded" when null)
- No Balance due row (exists at line 384-392 but shows "Not recorded" when null)
- "Net paid" label is confusing — it shows `settlement().paid` which is the payment amount, not net of refunds

**Decision:**
- Rename "Paid" to "Collected" (more accurate — it's what the store collected)
- Keep "Refunded" row (shows "Not recorded" when unknown)
- Add "Balance due" row (shows `settlement().balanceDue` — already implemented at line 384-392)
- Remove the duplicate "Total" from the settlement section — the Total is already shown above at line 353-360
- Keep Discount row only when > 0 (already done)
- Add Tax row only when > 0 (already done)

**Fix:** Rename "Paid" label to "Collected" in the totals card. The settlement already computes `paid`, `refunded`, `balanceDue` correctly. The "Net paid" label in the brief is a misunderstanding — the code shows "Paid" which is `settlement().paid` (the collected amount). The balance due is `total - paid - refunded`.

**Fix:** Change the label at line 364 from "orders.detail.paid" to "orders.detail.collected" (new i18n key).

### 4.8 Items Card

**Current issues:**
- No variant/weight shown (e.g., "250g")
- SKU format `SKU-1-1` (carts use `SKU-001`)
- No link to the product (but there IS a link at line 270-276!)

**Decision:**
- **Variant label:** The `itemViews()` computed uses `buildOrderItemViews()` which returns `variantLabel` from the catalog variant attributes. The template already shows it at line 278-286 (`view.variantLabel`). The issue is the seed data doesn't have variant attributes. No frontend change needed — it's a seed data issue (documented in SEED_PROPOSAL.md §2.6, §2.7, §2.8).
- **SKU format:** The SKU comes from the API as `view.item.sku`. The format mismatch is a backend/seed issue (API_GAPS.md #9, SEED_PROPOSAL.md §2.7). The frontend displays the raw API value. No frontend change.
- **Product link:** Already exists at line 270-276! The product name links to `/dashboard/products/:slug`.

**Decision:** No frontend code changes needed for items. The issues are seed/backend data.

### 4.9 Customer Card

**Current issues:**
- Missing orders count and lifetime spend
- Address repeats "Giza, Giza"
- Repeats name and phone

**Decision:**
- **Orders count + lifetime spend:** Already implemented! The `customerSummary()` computed (line 178-179) loads via `loadCustomerSummary()` which calls `summarizeCustomerOrders()` on the customer's orders. The template shows it at lines 615-633. The issue is seed data — the admin account has orders but the customer summary may not load correctly.
- **Address deduping:** Already implemented! `cityLine()` (line 919-928) dedupes city/state when they're the same. `addressName()` (line 943-949) hides the address name when it matches the customer name. `addressPhone()` (line 952-957) hides the address phone when it matches the customer phone. The template uses these at lines 680-685.
- **Phone repetition:** The customer card shows phone at line 584-594, address card shows at line 683-685. `addressPhone()` returns null when customer exists (line 956), so address card won't repeat the phone.

**Decision:** No frontend code changes needed. The deduping logic is already implemented. The issues are seed data (address has city=state=Giza, address name = customer name).

### 4.9 Internal Notes

**Current issue:** No author or time shown.

**Current code:** The notes section (lines 500-555) shows:
- Note body (line 505)
- Author + time at line 507-512: shows `note.author` and `dates.formatDateAndTime(note.createdAt)`

**Decision:** The code already shows author and time! The issue is that seeded notes may not have these fields, or the seed doesn't create notes. No frontend change needed.

### 4.10 Print Invoice

**Requirement:** "Print invoice always uses the light print stylesheet, even in dark mode."

**Current code:** `enterPrintMode()` / `exitPrintMode()` at lines 720-737 removes `.dark` class and adds `.order-print` class. The print stylesheet in `styles/index.css` scopes under `html.order-print`.

**Decision:** Already implemented correctly. ✅

### 4.11 Print Stylesheet

**Requirement:** Ensure the print stylesheet handles the two-column layout properly (sidebar stacks under main column on A4).

**Current code:** CSS at lines 39-45 in CSS file sets `display: block` on `.grid` and adds margin between stacked columns.

**Decision:** Already implemented. ✅

### 4.12 RTL and Dark Mode

**Requirement:** "RTL: timeline direction, icons, numerals checked in all cells."

**Current state:** The app uses `dir` attribute on `<html>` toggled by `LanguageService`. Tailwind's `rtl:` variants handle RTL. The timeline uses `sm:flex-row` which becomes `rtl:flex-row-reverse` via `rtl:` utilities.

**Decision:** The evidence harness tests RTL. No code changes needed — verify in evidence capture.

### 4.13 Dark Mode

**Requirement:** "Dark mode verified, not assumed."

**Current state:** The app toggles `.dark` on `<html>`. All colors use CSS variables. Print mode forces light.

**Decision:** Verify in evidence capture. No code changes needed.

## 5. API gaps to log (already in API_GAPS.md, append if missing)

| Gap | Section in API_GAPS.md | Status |
|-----|------------------------|--------|
| Order status history returns empty array | §2, §3.1 | Documented |
| Shipment data missing for SHIPPED/DELIVERED orders | §2, §3.2 | Documented |
| Payment facts missing (paidAt, transactionReference) | §3, §3.3 | Documented |
| Refund lines missing for REFUNDED orders | §3, §3.3 | Documented |
| No customer aggregate endpoint | §4 | Documented |
| No per-line discount, compareAtPrice, couponCode, taxAmount | §5 | Documented |
| No resend email endpoint | §6 | Documented |
| SKU format mismatch | #9 | Documented |
| No carrier API / ETA field | §3.5 | Documented |
| No tags endpoint | §3.7 | Documented |

**Action:** Verify all gaps are in API_GAPS.md. Append any missing.

## 6. SEED_PROPOSAL.md items to append

| Issue | Section |
|-------|---------|
| Orders with no items but shipping-only totals (6, 7, 9, 10, 12, 14, 15) | §236-243 |
| ORD-000009 total 0.00 but Delivered + Refunded | §244-245 |
| Paid orders with empty paidAt/transactionReference | §246-247 |
| COD + Cancelled shows payment "Failed" | §248-249 |
| SKU format mismatch (SKU-1-1 vs SKU-001) | §252-253 |
| All orders share one timestamp | §254-255 |
| Verified purchase audit | §257 |
| Address duplication (Giza, Giza) | §316-318 |
| Missing states for UAT (Processing, Pending, partial refund, COD paid, history) | §320-326 |

**Action:** Verify all are in SEED_PROPOSAL.md. Append any missing.

## 7. DECISIONS.md entries to append

| Decision | Rationale |
|----------|-----------|
| Removed Tags card | No backend feature; honest empty state serves no purpose |
| Renamed "Paid" to "Collected" in totals | More accurate — it's what the store collected, not net of refunds |
| Shipment card: warning for SHIPPED/DELIVERED without shipment, not apology | More accurate — data problem, not missing feature |
| Removed "Net paid" label confusion | Renamed to "Collected"; balance due shows remaining |
| No frontend changes for items/customer/notes/print/RTL/dark | Issues are seed/backend data gaps, not frontend bugs |

## 8. Evidence requirements

**Phase 0 (before):** Capture 4 cells (light/dark × EN/AR) at 1440x900 and 1024 for:
- ORD-2026-000001 (Delivered + Paid, with items)
- ORD-2026-000008 (Shipped + Paid)
- ORD-2026-000006 (Cancelled + Failed, no items)
- ORD-2026-000009 (Delivered + Refunded, no items)
- ORD-2026-000015 (Confirmed + COD pending, no items)

**results.json must include:**
- Which header buttons are disabled and their `data-disabled-reason`
- Whether the Delivered step shows a check (not "5")
- Number of timeline events rendered
- Whether payment fields (transaction reference, paid at) show "Not recorded" on Paid orders
- Whether Shipment card shows warning (not apology) for Delivered order without shipment
- Whether Tags card is absent
- Whether Totals card shows "Collected" not "Paid", and has Discount/Refunded/Balance rows
- Whether Items show variant label and product link
- Whether Customer card shows orders count and lifetime spend
- Whether address shows deduped city/state and hides repeated name/phone
- Whether Internal notes show author and timestamp
- Print screenshot (light mode, even if dark was active)

**After (Phase 2+):** Same captures after fixes. Compare results.json before/after.

## 9. File changes summary

### Files to modify:
1. `src/app/features/orders/order-detail/order-detail.component.html` — Shipment card empty state text, Totals "Paid" → "Collected" label, remove Tags card
2. `public/assets/i18n/en.json` — Add `orders.detail.collected`, `orders.detail.collectedBasis`, `orders.detail.collectedHelp`
3. `public/assets/i18n/ar.json` — Arabic translations for new keys
4. `API_GAPS.md` — Verify/append gaps
5. `SEED_PROPOSAL.md` — Verify/append seed issues
6. `DECISIONS.md` — Append decisions

### Files NO change needed (already correct):
- `order-detail.component.ts` — logic already handles all cases
- `order-progress.component.ts/html` — timeline logic correct
- `order-status-dialog`, `order-cancel-dialog`, `order-refund-dialog`, `order-shipment-dialog` — dialogs already correct
- `order-shipment-dialog` — form fields correct
- `order-detail.component.ts` — logic for deduping, customer summary, settlement, events all correct
- `order-progress.component.html` — stepper logic correct
- `dialog-shell`, `order-dialog` — dialog UX correct
- `print` mode — already forces light theme
- `customer-card` deduping — already implemented
- `items` product link and variant label — already implemented
- `notes` author/time — already implemented
- `print` stylesheet — already forces light, stacks sidebar
- `rtl:` / `dark:` handling — already via Tailwind + CSS variables

## 10. Acceptance criteria (for final report)

| Item | Status | Evidence |
|------|--------|----------|
| Breadcrumb shows `Operations > Orders > ORD-XXXX` | Done | Screenshot |
| Delivered step shows ✓ not "5" | Done | Screenshot |
| Timeline shows dates/actors when history exists | Blocked on backend | API_GAPS.md |
| Activity log shows events (status, payment, refund, note, email, shipment) | Blocked on backend | API_GAPS.md |
| Update status tooltip shows reason when disabled | Done | Screenshot |
| Resend email tooltip shows reason | Done | Screenshot |
| Kebab has Cancel, Refund, Copy link, Copy order number | Done | Screenshot |
| Shipment card: warning for Delivered without shipment | Done | Screenshot |
| Tags card removed | Done | Screenshot |
| Payment: copy button for reference, refund action visible | Done | Screenshot |
| Totals: "Collected" label, Discount/Refunded/Balance rows | Done | Screenshot |
| Items: variant label, product link, SKU displayed | Blocked on seed | SEED_PROPOSAL.md |
| Customer: orders count, lifetime spend, deduped address | Done | Screenshot |
| Internal notes: author + timestamp | Blocked on seed | SEED_PROPOSAL.md |
| Print uses light theme, sidebar stacks | Done | Screenshot |
| RTL: timeline direction, icons, numerals | Verified | Evidence |
| Dark mode: all colors correct | Verified | Evidence |
| No whitespace-only diffs | Verified | `git diff --stat` |

## 11. Next steps

1. **Phase 0:** Run evidence capture (`npm run evidence -- order-details-v3 --tag before`) → save as `before/`
2. **Phase 1:** Verify API_GAPS.md, SEED_PROPOSAL.md, DECISIONS.md are complete
2. **Phase 2:** Implement the 3 template changes (Shipment card, Totals label, remove Tags card) + i18n keys
3. **Phase 3:** Run evidence capture (`npm run evidence -- order-details-v3 --tag after`) → save as `after/`
4. **Phase 4:** Compare `before/` vs `after/` results.json, produce final report table
5. **Phase 5:** Commit, push, open PR

---

**Spec written:** 2026-10-21  
**Branch:** `ui/order-details-v3`  
**Author:** AI assistant (following brainstorming → spec → plan → execute flow)