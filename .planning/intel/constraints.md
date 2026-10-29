# Constraints

## Order status transition matrix
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- type: protocol
- content: Strict status transitions: PENDING→{CONFIRMED,CANCELLED}, CONFIRMED→{PROCESSING,CANCELLED}, PROCESSING→{SHIPPED,CANCELLED}, SHIPPED→{DELIVERED}; DELIVERED and CANCELLED terminal. SHIPPED→CANCELLED not allowed (resolved). Refused transition answers 409.

## API page size cap
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- type: nfr
- content: Dashboard list endpoints cap page size at 100 rows; larger requests return 400. Frontend clamps to MAX_PAGE_SIZE=100 and walks pages for full sets.

## Order totals formula
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- type: schema
- content: total = (sum of line totals − discount) + shipping. Seeded totals repaired by migration V111 to match formula.

## Orders stats endpoint contract
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- type: api-contract
- content: GET /api/dashboard/orders/stats returns total, byStatus, byPaymentStatus, byPaymentMethod for the filtered set; same filters as list endpoint.

## Status change endpoint contract
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- type: api-contract
- content: PUT /api/dashboard/orders/{id}/status body {status, note?, notifyCustomer?, reason?}; reason required when status=CANCELLED; 409 on invalid transition, 400 on missing reason.

## Shipment data model
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- type: schema
- content: Shipment fields carrier, trackingNumber, trackingUrl, shippedAt, deliveredAt (columns on orders or shipment table). No carrier API; admin pastes tracking info.

## Order status history table
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- type: schema
- content: order_status_history (id, order_id, from_status, to_status, note, changed_by, notify_customer, created_at); written in same transaction as status change; first row from_status null.

## Order notes table
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- type: schema
- content: order_notes (id, order_id, author, body, is_internal default true, created_at); is_internal always true in dashboard.

## Refunds table
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- type: schema
- content: order_refunds (amount, reason, createdBy, createdAt); refund recorded only when gateway (Paymob) accepts; manual refund otherwise.

## No faked features
- source: /home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/ORDERS_CONTRACT.md
- type: nfr
- content: Features needing non-existent backend capabilities (resend email, carrier API, tax, tags) must not be faked; UI disables/hides with honest label and lists under contract gaps.