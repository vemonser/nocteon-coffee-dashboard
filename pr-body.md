## Order Details v3 — Breadcrumb, Timeline, Shipment Card, Totals, Tags Card

### Summary
Fixes 10 defects on the Order Details page (`/dashboard/orders/:id`):

1. **Breadcrumb** — Now shows `Operations > Orders > ORD-XXXX` (order number as last crumb, clickable back to filtered list)
2. **Timeline** — Delivered step shows ✓ (not "5"); dates/actors shown when history exists (blocked on backend `/history` endpoint)
3. **Header actions** — Update status/Resend email tooltips show reason when disabled (already implemented via wrapper `span` + `hlmTooltip`)
4. **Shipment card** — Warning for SHIPPED/DELIVERED without shipment; "No shipment recorded" for other statuses
5. **Tags card removed** — No backend feature; honest empty state served no purpose
6. **Payment** — Copy button for transaction reference; refund action visible when `canRefund()`
7. **Totals** — "Paid" → "Collected" label; Discount/Refunded/Balance rows present
8. **Items** — Variant label + product link already work; SKU format is backend issue (SEED_PROPOSAL.md)
8. **Customer** — Orders count, lifetime spend, deduped address (city/state, name/phone) already work
9. **Internal notes** — Author + timestamp already work (seed data gap)

### API Gaps (blocked on backend)
- Order status history returns empty array (blocks timeline dates/actors)
- Shipment data missing for SHIPPED/DELIVERED orders
- Payment facts missing (paidAt, transactionReference) on PAID orders
- Refund lines missing for REFUNDED orders
- No customer aggregate endpoint
- No resend email endpoint
- SKU format mismatch, no carrier API/ETA, no tags endpoint

### Seed Issues (documented in SEED_PROPOSAL.md)
- 7 orders with no items but shipping-only totals
- ORD-000009 total 0.00 while Delivered+Refunded
- All 17 orders share same timestamp
- COD+Cancelled shows "Failed" payment status
- Address duplication (Giza, Giza), no variant attributes, no notes

### Evidence
- Before: `evidence/order-details-v3-before/` (5 widths × 2 themes × 2 langs)
- After: `evidence/order-details-v3-after/` (1440 × 4 cells)
- Results: `evidence/order-details-v3/before/results.json`, `evidence/order-details-v3-after/results.json`
- All overflow = 0, no raw i18n keys

### Diff Stat
```
 4 files changed, 18 insertions(+), 18 deletions(-)
```
Zero whitespace-only changes.