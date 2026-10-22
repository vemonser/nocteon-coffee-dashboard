# ui/order-details-v4 — Execution Tracker

## Tasks (in execution order)
- [x] 1. Fix build: add `inlineFonts: false` to angular.json
- [x] 2. Build production → serve on :4200 → capture BEFORE evidence (48 cells)
- [x] 3. Fix Issue 1: client-side userId filter in loadCustomerSummary
- [x] 4. Fix Issue 2: visible "Regular price" label + reconciliation unit test
- [x] 5. Fix Issue 3: displaySku in adapter + template + tests + SEED_PROPOSAL
- [x] 6. Fix Issue 4: add collectedAt translation key + document resend decision
- [x] 7. Fix Issue 5: text-warning → text-muted-foreground for "Not recorded" spans
- [x] 8. Fix Issue 6: append v4 findings to API_GAPS.md
- [x] 9. Add/update unit tests (customer-summary, order-totals, order-items) — 85/85 pass
- [x] 10. Add v4 assertion mode to assert-order-evidence.mjs (checkV4 + 48/48 pass)
- [x] 11. Rebuild → capture AFTER evidence (48 cells)
- [x] 12. Run unit tests + v4 assertions (green on merged main)
- [x] 13. Write final verification report → evidence/order-details-v4/VERIFICATION.md

## Completed
- [x] Committed on ui/order-details-v4 (15 files, 321 insertions, 33 deletions)
- [x] Merged into main via --no-ff (merge commit f80be562)
- [x] Tests pass on merged result: 85/85 unit + 48/48 v4 assertions
- [x] Deleted local ui/order-details-v4 branch (fully merged)

## Issues summary
1. Customer stats show store-wide numbers (userId ignored by backend) → client-side filter
2. Struck-through price lacks visible "Regular price" label → add visible label
3. SKU mismatch (SKU-1-1 vs SKU-001) → displaySku prefers variant SKU
4. Resend email always disabled (by design); collectedAt key missing → document + add key
5. Amber "Not recorded" text → muted-foreground for inline spans only
6. Timeline blocked on backend → document in API_GAPS.md
7. Missing states, responsive, RTL → verify via evidence
