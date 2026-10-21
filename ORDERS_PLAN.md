# Orders polish — working plan

Branch: `feature/orders-polish` (from `backup/pre-orders-work`)

Legend: [ ] todo · [~] in progress · [x] done · [!] blocked (contract gap)

## Phase 0 — Harness
- [ ] 0.1 production `ng build` passes; record :4200 cwd + branch
- [ ] 0.2 extend `npm run evidence` to orders list / details / status / cancel / refund dialogs
- [ ] 0.3 "before" screenshots of orders list + details in all 20 cells

## Phase 1 — Data integrity
- [ ] 1.1 totals root cause + unit tests (fixtures)
- [ ] 1.2 KPI cards vs table reconciliation; stats endpoint contract
- [ ] 1.3 status model (order / payment / methods / transitions)
- [ ] 1.4 orders without items — counts per cause
- [ ] 1.5 clipping root cause + fix
- [ ] 1.6 one helper for money / dates / order number; grep report
- [ ] 1.7 ORDERS_SEED_PROPOSAL.md (no execution)

## Phase 2 — Language & Arabic
- [ ] 2.1 runtime-reactive i18n for every header/status/label; e2e en→ar→en
- [ ] 2.2 glossary consistency + test
- [ ] 2.3 Intl plurals, sentence case, ج.م, "من"
- [ ] 2.4 dir="auto" + bdi for customer text

## Phase 3 — Orders list
- [ ] 3.1 column order + row click + hide raw ID
- [ ] 3.2 semantic status colours, never colour alone
- [ ] 3.3 status tabs with counts, filters, URL state, server-side sort
- [ ] 3.4 row actions + bulk actions + CSV export
- [ ] 3.5 loading / empty / error states
- [ ] 3.6 design.md list pattern

## Phase 4 — Order details layout
- [ ] 4.1 two-column layout + header + actions
- [ ] 4.2 main column: items / totals / timeline / notes
- [ ] 4.3 sidebar: customer / address / payment / shipment / tags
- [ ] 4.4 "Update status" dialog with valid transitions only
- [ ] 4.5 no section taller than 1.5x content; no clipping

## Phase 5 — Tracking, history, notes
- [ ] 5.0 ORDERS_CONTRACT.md + **USER APPROVAL** (STOP)
- [ ] backend after approval
- [ ] frontend after approval

## Phase 6 — States, interactions, a11y
- [ ] 6.1 loading/error/empty per section + failure-injection e2e
- [ ] 6.2 race protection
- [ ] 6.3 store time zone
- [ ] 6.4 drill-down links
- [ ] 6.5 accessibility

## Phase 7 — Responsive & final
- [ ] 7.1 375 / 768 behaviour
- [ ] 7.2 full evidence matrix + contact sheets
- [ ] 7.3 design.md + DECISIONS.md
