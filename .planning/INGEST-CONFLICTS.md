## Conflict Detection Report

### BLOCKERS (0)

(none)

### WARNINGS (0)

(none)

### INFO (3)

[INFO] Auto-resolved: ADR > SPEC on orders backend contract (history/notes/shipment)
  Found: docs/spec ORDERS_CONTRACT.md declares order_status_history, order_notes, shipment columns as "NOT REAL" (§4 table) and contract status "PROPOSAL — nothing built"
  Note: DECISIONS.md (ADR, precedence 0) records these as built (status history table, order_notes table, shipment columns, gateway refund via Paymob). ADR wins; synthesized intel reflects implemented state; contract retained as historical proposal.
  → No action required; contract text is historical context

[INFO] Auto-resolved: ADR > SPEC on gateway refund capability
  Found: ORDERS_CONTRACT.md §4 declares "Payment gateway refund: NOT REAL / no refund endpoint"
  Note: DECISIONS.md records refund built via Paymob (POST /api/acceptance/refunds), recorded only on gateway acceptance. ADR wins.
  → No action required

[INFO] Auto-resolved: DOC >? API expectations vs decisions on product option usage endpoint
  Found: API_EXPECTATIONS.md lists GET .../values/{id}/usage as [missing]
  Note: DECISIONS.md notes backend now implements usage endpoint (returns {count}) and frontend getValueUsageCount available. Lower-precedence DOC lags implementation; ADR/implementation wins.
  → No action required