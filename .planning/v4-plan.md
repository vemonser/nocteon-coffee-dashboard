# ui/order-details-v4 — 7 Issue Fix Plan

## Confirmed Issues (verified against live API + evidence)

### Issue 1: Customer stats showing store-wide numbers
- **Root cause:** Backend accepts `userId` query param but silently ignores it.
  API call `?userId=1&size=100` returns all 17 orders, not the 4 belonging to customer 1.
- **Fix:** Add client-side filter `orders.filter(o => o.customer?.id === customerId)` in `loadCustomerSummary()`.
- **Test:** Add unit test with multi-customer fixture proving the filter works.
- **Doc:** Append to API_GAPS.md.

### Issue 2: Struck-through price not reconciled in totals
- **Root cause:** Catalog `compareAtPrice` (650 × 1.15 = 747.50) is shown with `<s>` strike-through,
  but there's no visible label and it's not an order-level discount. The totals discount row only
  shows `order.discountAmount` (0 for order 1).
- **Fix:** Add visible "Regular price" label to the strike-through; ensure it's clearly a comparison, not a discount.
  Add unit test proving compare-at is NOT subtracted from totals.
- **Test:** Add to order-totals.spec.ts.

### Issue 3: SKU display + format mismatch
- **Root cause:** Template shows `{{ view.item.sku }}` (raw order-item SKU "SKU-1-1"). Catalog variant
  has a different SKU format ("SKU-001"). Same product shows different SKUs on different screens.
- **Fix:** Add `displaySku` to `OrderItemView` preferring `variant.sku ?? item.sku`.
- **Doc:** Append to SEED_PROPOSAL.md.
- **Test:** Update adapter spec.

### Issue 4: Disabled buttons + tooltips + Resend email
- **Root cause:** `resendReason` always returns the gap message — "Resend email" is always disabled.
  Missing translation key `orders.detail.collectedAt` (raw key reaches screen for COD paid orders).
  Tooltips need to be visible on keyboard focus.
- **Fix:** Keep "Resend email" disabled (no backend endpoint — document as decision). Add missing
  `collectedAt` translation key. Verify tooltip focus behavior.
- **Doc:** Append decision to DECISIONS.md.

### Issue 5: Amber "Not recorded" text
- **Root cause:** "Not recorded" uses `text-warning` (amber) in multiple places. design.md §4:
  warning is only for soft badges/banners with icons, not inline text.
- **Fix:** Change `text-warning` to `text-muted-foreground` for all "Not recorded" spans.
- **Test:** Verify contrast ≥ 4.5:1.

### Issue 6: Timeline/activity blocked on backend
- **Current:** Adapter `buildOrderEvents` correctly handles populated fixture. Backend returns no history.
- **Fix:** No code change needed. Document blocked-on-backend in API_GAPS.md.

### Issue 7: Missing states, responsive, RTL verification
- **Fix:** Verify via evidence capture (before/after at 1440+1024, EN+AR, light+dark).

## Execution Order

1. Add `order-details-v4` target set to evidence-targets.mjs
2. Add v4 mode to assert-order-evidence.mjs
3. Build + serve current code → capture before evidence
4. Fix code (Issues 1-5)
5. Add/update unit tests
6. Add missing translations
7. Rebuild → capture after evidence
8. Run assertions
9. Append to DECISIONS.md, API_GAPS.md, SEED_PROPOSAL.md
10. Write final verification report
