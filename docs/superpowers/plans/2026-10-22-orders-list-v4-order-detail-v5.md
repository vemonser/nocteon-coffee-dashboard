# Orders list v4 + Order detail v5 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the orders list and the order detail page so every number comes from the API, the timeline shows recorded history, the actions respect the order's state, and RTL works in Arabic. The backend gets four seed migrations and the stats endpoint gains two aggregate fields.

**Architecture:** Two specs, one plan. The backend changes are prerequisites for both frontend pages. The frontend changes are independent but share types/utils. We work repo-by-repo: backend first (migrations, enum, stats endpoint), then dashboard (list page, detail page, shared utils, i18n).

**Tech Stack:** Spring Boot 4.1 / Java 21 / Flyway / PostgreSQL | Angular 22 / Signals / TanStack Table / Spartan NG / Transloco / Vitest / Playwright

**Specs:**
- `docs/superpowers/specs/2026-10-22-orders-list-v4-design.md`
- `docs/superpowers/specs/2026-10-22-order-detail-v5-design.md`

---

## Global Constraints

- TypeScript strict: `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- Tailwind 4 via PostCSS, no `tailwind.config.js`
- Spartan UI: `HlmXxxImports` barrels, Lucide icons via `provideIcons` per component
- All components standalone, signals over RxJS, `inject()` over constructor
- i18n: Transloco JSON in `public/assets/i18n/en.json` and `ar.json` — no raw keys ever
- RTL: `LanguageService` toggles `dir="rtl"` on `<html>`, CSS handles font switching
- Theme: light/dark via `.dark` on `<html>`, accent via `data-theme="burgundy"`
- Page size: API caps at 100; `getEveryOrder` walks pages
- Flyway: version collision — repo has two `V111__` files, DB has 111 and 112
- Backend base URL: `http://localhost:8080/api/dashboard/orders`
- No linter/formatter script; use `npx prettier --write` if needed

---

## Review Focus (the five inputs most likely to bite)

| Input / condition | Expected behaviour | Owner task |
|---|---|---|
| Orders list with 101+ orders | KPI cards show backend aggregates, not a client-side sum of the first 100 rows | Task B3 (backend stats) + Task F1 (frontend KPI) |
| Cancelled COD order | Payment status shows "Not collected" (NOT_COLLECTED), never "Failed" | Task B2 (enum) + Task F4 (table) |
| ORD-9 (no line items) | Total is real (not 0.00), items shows warning icon + tooltip | Task B4 (seed) + Task F4 (table) |
| Order detail with empty history | Timeline shows only `createdAt` + "Step dates not recorded" banner, no invented dates | Task F9 (timeline) |
| Runtime language switch (EN→AR) | Every label, badge, tooltip, breadcrumb, number updates without reload | Task F13 (RTL pass) |

---

## Task Map

| # | Area | Task |
|---|---|---|
| **Backend — migrations & schema** |
| B1 | Flyway | Rename `V111__fix_review_and_media_seed.sql` → `V112__fix_review_and_media_seed.sql` (no content change) |
| B2 | Enum | Add `NOT_COLLECTED` to `PaymentStatus` |
| B3 | Stats endpoint | Add `revenue` (BigDecimal) and `revenueOrderCount` (long) to `OrderStatsResponse`; implement in `OrderStatsService` + repository |
| B4 | Seed fix — COD cancelled | Migration `V113__cod_cancelled_payment_status.sql`: set `NOT_COLLECTED` on cancelled COD orders (6, 10) |
| B5 | Seed fix — ORD-9 | Migration `V114__ord_9_line_items.sql`: add line items + recompute total for ORD-9 |
| B6 | History migration | `V115__order_status_history.sql`: populate `order_status_history` for 17 seeded orders |
| B7 | Shipment stamps | `V116__shipment_delivery_stamps.sql`: stamp `shippedAt`/`deliveredAt`, add `estimatedDeliveryAt` column |
| B8 | Payment facts | `V117__payment_facts_on_paid_orders.sql`: set `paidAt`/`transactionReference` on PAID orders |
| B9 | Refund rows | `V118__refund_rows_for_refunded_orders.sql`: insert refund rows for REFUNDED orders missing them |
| B10 | Backend services | Wire history writer in `OrderStatusService`, ETA in `OrderShipmentService`, facts in `PaymentService` |
| B11 | Backend tests | Unit tests for the new aggregates, history writer, shipment stamps, payment facts |

| **Frontend — shared & list** |
| F1 | Types | Add `NOT_COLLECTED` to `PaymentStatus`; add `notCollected` to `StatusKind`; add `canChangeStatus`/`canCancel`/`canRefund` helpers |
| F2 | KPI utils | `order-kpi.ts`: `computeKpi(view, stats)`, `tabToApiParams(status)` — pure, unit-tested |
| F3 | i18n | Add all EN/AR keys: 4 card labels, 4 tooltips, 7 tabs, scope notes, empty states, warnings, copy actions |
| F4 | Orders list component | Scope model (view = filters ∩ tab), dual stats calls, 4 cards, 7 tabs (Refunded = payment status), table column budgets (1176px), customer tooltip (name+email), Created at one line, items count, 0.00 warning, NOT_COLLECTED rule, export walks pages |
| F5 | Data table | Add `emptyAction` opt-in for "Clear filters" button in empty state |
| F6 | Status badge | Add `notCollected` kind (muted tokens) |
| F7 | List E2E | Rewrite `e2e/orders.spec.ts` + extend `e2e/orders-states.spec.ts` to the new spec |

| **Frontend — detail page** |
| F8 | Header actions | State-aware visibility (hide disabled actions from kebab), Copy order number (clipboard), Print, Update status dropdown (allowed next statuses only), Cancel/Refund only when allowed |
| F9 | Timeline | Progress tracker (steps from history, "Not recorded"), merged activity log (buildOrderEvents), banner when history empty |
| F10 | Customer card | Customer's own numbers (summarizeCustomerOrders), tooltip with basis, link to user + link to their orders list |
| F11 | Items | SKU once, no fake strikethrough, catalog `compareAtPrice` as "Regular price" with tooltip, variant label translated at render, no-items warning |
| F12 | Totals + Settlement | Subtotal/Discount/Shipping/Tax/Total, then Collected/Refunded/Balance (null = "Not recorded"), warnings only on actual conditions |
| F13 | Shipment | Read card + edit dialog with ETA field, warning on SHIPPED/DELIVERED with no shipment |
| F14 | RTL & states | Breadcrumb RTL, skeleton, 404, error, print stylesheet |
| F15 | Detail E2E | New `e2e/order-detail.spec.ts` covering all states |

| **Docs & hygiene** |
| D1 | Docs | Update `API_GAPS.md` (close gaps #1, #4), `DECISIONS.md`, `SEED_PROPOSAL.md`, `e2e/README.md` |
| D2 | Evidence | Run Evidence Gate (backend verify + frontend verify + browser captures) |

---

## BACKEND TASKS

### Task B1: Rename Flyway V112 (fix version collision)

**Files:**
- Modify: `nocteon-backend/src/main/resources/db/migration/V111__fix_review_and_media_seed.sql` → `V112__fix_review_and_media_seed.sql`

**Interfaces:**
- Consumes: nothing
- Produces: Flyway migration at version 112 (matches what the live DB already has)

- [ ] **Step 1: Verify the collision**
```bash
cd nocteon-backend && ls src/main/resources/db/migration/V111*
# Should show two files
```

- [ ] **Step 2: Rename the second file**
```bash
cd nocteon-backend
git mv src/main/resources/db/migration/V111__fix_review_and_media_seed.sql \
       src/main/resources/db/migration/V112__fix_review_and_media_seed.sql
```

- [ ] **Step 3: Verify Flyway would start clean**
```bash
cd nocteon-backend && ./mvnw flyway:info -q
# Should show 112 as the last applied (or pending), no duplicate version error
```

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "chore(flyway): rename V111→V112 to resolve version collision"
```

---

### Task B2: Add `NOT_COLLECTED` to `PaymentStatus`

**Files:**
- Modify: `nocteon-backend/src/main/java/com/nocteon/nocteon_api/payment/enums/PaymentStatus.java`

**Interfaces:**
- Consumes: nothing
- Produces: `PaymentStatus.NOT_COLLECTED` usable in entity, DTO, service

- [ ] **Step 1: Write the failing test**
```java
// src/test/java/.../payment/enums/PaymentStatusTest.java
@Test void notCollectedExists() {
    assertNotNull(PaymentStatus.NOT_COLLECTED);
    assertEquals("NOT_COLLECTED", PaymentStatus.NOT_COLLECTED.name());
}
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Add enum value**
```java
// PaymentStatus.java
public enum PaymentStatus {
    PENDING,
    PAID,
    FAILED,
    REFUNDED,
    NOT_COLLECTED   // <-- add
}
```

- [ ] **Step 4: Run test → PASS**

- [ ] **Step 5: Commit**

---

### Task B3: Stats endpoint — add `revenue` and `revenueOrderCount`

**Files:**
- Modify: `nocteon-backend/src/main/java/com/nocteon/nocteon_api/order/dto/response/OrderStatsResponse.java`
- Modify: `nocteon-backend/src/main/java/com/nocteon/nocteon_api/order/service/OrderStatsService.java`
- Modify: `nocteon-backend/src/main/java/com/nocteon/nocteon_api/order/repository/OrderRepository.java`
- Create: `nocteon-backend/src/test/java/.../order/service/OrderStatsServiceTest.java`

**Interfaces:**
- Consumes: `OrderFilterRequest` (same as before)
- Produces: `OrderStatsResponse` with two new fields:
  - `BigDecimal revenue` — Σ of paid non-cancelled orders minus refunds
  - `long revenueOrderCount` — count of orders that entered the revenue sum

- [ ] **Step 1: Write failing test for `OrderStatsResponse`**
```java
// OrderStatsServiceTest.java
@Test void statsIncludeRevenueAndCount() {
    OrderStatsResponse resp = service.getStats(emptyFilter());
    assertNotNull(resp.getRevenue());
    assertNotNull(resp.getRevenueOrderCount());
}
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Add fields to `OrderStatsResponse`**
```java
// OrderStatsResponse.java
@Getter @Setter @Builder
public class OrderStatsResponse {
    private long total;
    private List<StatusCount> byStatus;
    private List<PaymentStatusCount> byPaymentStatus;
    private List<PaymentMethodCount> byPaymentMethod;

    // NEW
    private BigDecimal revenue;
    private long revenueOrderCount;
}
```

- [ ] **Step 4: Add aggregate queries to `OrderRepository`**
```java
// OrderRepository.java
@Query("""
    SELECT COALESCE(SUM(o.totalAmount), 0), COUNT(o)
    FROM Order o
    WHERE o.paymentStatus = 'PAID'
      AND o.status != 'CANCELLED'
      AND (:status IS NULL OR o.status = :status)
      AND (:paymentStatus IS NULL OR o.paymentStatus = :paymentStatus)
      AND (:paymentMethod IS NULL OR o.paymentMethod = :paymentMethod)
      AND o.createdAt >= :dateFrom
      AND o.createdAt < :dateTo
      AND (:search IS NULL OR LOWER(o.orderNumber) LIKE :search ...)
    """)
List<Object[]> getRevenueAggregate(@Param("status") OrderStatus status, ...);

@Query("""
    SELECT COALESCE(SUM(r.amount), 0)
    FROM OrderRefund r
    JOIN r.order o
    WHERE o.paymentStatus = 'PAID'
      AND o.status != 'CANCELLED'
      AND (:status IS NULL OR o.status = :status)
      ...
    """)
BigDecimal getRefundedAggregate(@Param("status") OrderStatus status, ...);
```

- [ ] **Step 5: Implement in `OrderStatsService.getStats()`**
```java
// OrderStatsService.java
public OrderStatsResponse getStats(OrderFilterRequest filter) {
    // ... existing counts ...

    BigDecimal gross = revenueAgg[0] != null ? (BigDecimal) revenueAgg[0] : BigDecimal.ZERO;
    long revenueCount = revenueAgg[1] != null ? ((Number) revenueAgg[1]).longValue() : 0L;
    BigDecimal refunded = refundedAgg != null ? refundedAgg : BigDecimal.ZERO;
    BigDecimal revenue = gross.subtract(refunded);

    return OrderStatsResponse.builder()
        .total(total)
        .byStatus(...)
        .byPaymentStatus(...)
        .byPaymentMethod(...)
        .revenue(revenue)
        .revenueOrderCount(revenueCount)
        .build();
}
```

- [ ] **Step 6: Run test → PASS**

- [ ] **Step 7: Run full backend verify**
```bash
./mvnw verify
```

- [ ] **Step 8: Commit**

---

### Task B4: Migration `V113__cod_cancelled_payment_status.sql`

**Files:**
- Create: `nocteon-backend/src/main/resources/db/migration/V113__cod_cancelled_payment_status.sql`

**Interfaces:**
- Consumes: `PaymentStatus.NOT_COLLECTED` (Task B2)
- Produces: seeded orders 6 and 10 have `payment_status = 'NOT_COLLECTED'`

- [ ] **Step 1: Write migration**
```sql
-- V113__cod_cancelled_payment_status.sql
UPDATE orders
SET payment_status = 'NOT_COLLECTED'
WHERE status = 'CANCELLED'
  AND payment_method = 'CASH_ON_DELIVERY'
  AND payment_status IN ('PENDING', 'FAILED');
```

- [ ] **Step 2: Apply and verify**
```bash
cd nocteon-backend && ./mvnw flyway:migrate -q
PGPASSWORD=postgres psql -h localhost -U postgres -d nocteon_db \
  -c "select id, order_number, status, payment_status, payment_method from orders where id in (6,10);"
# Should show NOT_COLLECTED
```

- [ ] **Step 3: Commit**

---

### Task B5: Migration `V114__ord_9_line_items.sql`

**Files:**
- Create: `nocteon-backend/src/main/resources/db/migration/V114__ord_9_line_items.sql`

**Interfaces:**
- Consumes: product variants exist (V111/V112)
- Produces: order 9 has line items, total recomputed

- [ ] **Step 1: Write migration** (pick any two variants, e.g. 1 and 2)
```sql
-- V114__ord_9_line_items.sql
INSERT INTO order_items (order_id, product_variant_id, quantity, unit_price, total_price)
SELECT 9, 1, 1, 650.00, 650.00 WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_id=9 AND product_variant_id=1)
UNION ALL
SELECT 9, 2, 1, 689.00, 689.00 WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_id=9 AND product_variant_id=2);

-- Recompute total (same formula as V111)
UPDATE orders o
SET total_amount = (
    SELECT COALESCE(SUM(oi.total_price), 0) - COALESCE(o.discount_amount, 0) + o.shipping_cost
    FROM order_items oi WHERE oi.order_id = o.id
)
WHERE o.id = 9;
```

- [ ] **Step 2: Apply and verify**
```bash
cd nocteon-backend && ./mvnw flyway:migrate -q
PGPASSWORD=postgres psql -h localhost -U postgres -d nocteon_db \
  -c "select o.id, o.total_amount, oi.product_variant_id, oi.total_price from orders o left join order_items oi on oi.order_id=o.id where o.id=9;"
# total_amount should be > 0, two line items present
```

- [ ] **Step 3: Commit**

---

### Task B6: Migration `V115__order_status_history.sql`

**Files:**
- Create: `nocteon-backend/src/main/resources/db/migration/V115__order_status_history.sql`

**Interfaces:**
- Produces: `order_status_history` rows for all 17 seeded orders

- [ ] **Step 1: Write migration** (one creation row + transitions matching current status per order)
```sql
-- V115__order_status_history.sql
-- Order 1: DELIVERED → PENDING→CONFIRMED→PROCESSING→SHIPPED→DELIVERED
-- Order 2: DELIVERED → same chain
-- Order 3: DELIVERED → same chain
-- Order 4: DELIVERED → same chain
-- Order 5: DELIVERED → same chain
-- Order 6: CANCELLED → PENDING→CANCELLED
-- Order 7: CANCELLED → PENDING→CONFIRMED→CANCELLED (was ONLINE→FAILED)
-- Order 8: SHIPPED → PENDING→CONFIRMED→PROCESSING→SHIPPED
-- Order 9: DELIVERED → full chain
-- Order 10: CANCELLED → PENDING→CANCELLED (COD)
-- Order 11: DELIVERED → full chain
-- Order 12: CANCELLED (REFUNDED) → PENDING→CONFIRMED→PROCESSING→SHIPPED→DELIVERED→CANCELLED
-- Order 13: PROCESSING → PENDING→CONFIRMED→PROCESSING
-- Order 14: CANCELLED → PENDING→CONFIRMED→CANCELLED (ONLINE)
-- Order 15: CONFIRMED → PENDING→CONFIRMED
-- Order 16: DELIVERED → full chain
-- Order 17: DELIVERED → full chain

-- Insert using INSERT ... VALUES with ON CONFLICT DO NOTHING or WHERE NOT EXISTS
-- Each row: order_id, from_status, to_status, note, changed_by, notify_customer, created_at
-- created_at = order.created_at + incremental minutes
-- changed_by = 'seed'
```

- [ ] **Step 2: Apply and verify**
```bash
cd nocteon-backend && ./mvnw flyway:migrate -q
PGPASSWORD=postgres psql -h localhost -U postgres -d nocteon_db \
  -c "select order_id, from_status, to_status, changed_by, created_at from order_status_history order by order_id, created_at;"
# Every seeded order should have ≥1 row; DELIVERED orders should have 5 rows (creation + 4 transitions)
```

- [ ] **Step 3: Commit**

---

### Task B7: Migration `V116__shipment_delivery_stamps.sql`

**Files:**
- Create: `nocteon-backend/src/main/resources/db/migration/V116__shipment_delivery_stamps.sql`

**Interfaces:**
- Produces: `shippedAt` on SHIPPED orders, `deliveredAt` on DELIVERED orders, `estimatedDeliveryAt` column

- [ ] **Step 1: Write migration**
```sql
-- V116__shipment_delivery_stamps.sql
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS estimated_delivery_at TIMESTAMPTZ;

-- Stamp shippedAt for SHIPPED orders that have a shipment row
UPDATE shipments s
SET shipped_at = o.updated_at
FROM orders o
WHERE s.order_id = o.id
  AND o.status = 'SHIPPED'
  AND s.shipped_at IS NULL;

-- Stamp deliveredAt for DELIVERED orders that have a shipment row
UPDATE shipments s
SET delivered_at = o.updated_at
FROM orders o
WHERE s.order_id = o.id
  AND o.status = 'DELIVERED'
  AND s.delivered_at IS NULL;
```

- [ ] **Step 2: Apply and verify**
```bash
cd nocteon-backend && ./mvnw flyway:migrate -q
PGPASSWORD=postgres psql -h localhost -U postgres -d nocteon_db \
  -c "select order_id, shipped_at, delivered_at, estimated_delivery_at from shipments;"
# SHIPPED (8) and DELIVERED (1,2,3,4,5,9,11,16,17) should have stamps
```

- [ ] **Step 3: Commit**

---

### Task B8: Migration `V117__payment_facts_on_paid_orders.sql`

**Files:**
- Create: `nocteon-backend/src/main/resources/db/migration/V117__payment_facts_on_paid_orders.sql`

**Interfaces:**
- Produces: `paid_at` and `transaction_reference` on `payments` for PAID orders

- [ ] **Step 1: Write migration**
```sql
-- V117__payment_facts_on_paid_orders.sql
-- For ONLINE PAID orders: paid_at = order.updated_at, transaction_reference = 'PAYMOB-' || order.id
UPDATE payments p
SET paid_at = o.updated_at,
    provider_payment_id = 'PAYMOB-' || o.id
FROM orders o
WHERE p.order_id = o.id
  AND o.payment_status = 'PAID'
  AND o.payment_method = 'ONLINE'
  AND p.paid_at IS NULL;

-- For COD PAID orders: paid_at = order.updated_at, transaction_reference = 'COD'
UPDATE payments p
SET paid_at = o.updated_at,
    provider_payment_id = 'COD'
FROM orders o
WHERE p.order_id = o.id
  AND o.payment_status = 'PAID'
  AND o.payment_method = 'CASH_ON_DELIVERY'
  AND p.paid_at IS NULL;
```

- [ ] **Step 2: Apply and verify**
```bash
cd nocteon-backend && ./mvnw flyway:migrate -q
PGPASSWORD=postgres psql -h localhost -U postgres -d nocteon_db \
  -c "select order_id, paid_at, provider_payment_id from payments where paid_at is not null;"
# All PAID orders should have paid_at and a reference
```

- [ ] **Step 3: Commit**

---

### Task B9: Migration `V118__refund_rows_for_refunded_orders.sql`

**Files:**
- Create: `nocteon-backend/src/main/resources/db/migration/V118__refund_rows_for_refunded_orders.sql`

**Interfaces:**
- Produces: `order_refunds` rows for REFUNDED orders missing them

- [ ] **Step 1: Write migration**
```sql
-- V118__refund_rows_for_refunded_orders.sql
INSERT INTO order_refunds (order_id, amount, reason, created_by, created_at)
SELECT o.id, o.total_amount, 'Full refund (seed)', 'seed', o.updated_at
FROM orders o
WHERE o.payment_status = 'REFUNDED'
  AND NOT EXISTS (SELECT 1 FROM order_refunds r WHERE r.order_id = o.id);
```

- [ ] **Step 2: Apply and verify**
```bash
cd nocteon-backend && ./mvnw flyway:migrate -q
PGPASSWORD=postgres psql -h localhost -U postgres -d nocteon_db \
  -c "select order_id, amount, reason from order_refunds;"
# Orders 9 and 12 should have refund rows
```

- [ ] **Step 3: Commit**

---

### Task B10: Backend service wiring

**Files:**
- Modify: `nocteon-backend/src/main/java/.../order/service/OrderStatusService.java` (history writer on status change)
- Modify: `nocteon-backend/src/main/java/.../order/service/OrderShipmentService.java` (stamp `shippedAt`/`deliveredAt` on status transition, ETA field)
- Modify: `nocteon-backend/src/main/java/.../payment/service/PaymentService.java` (persist `paidAt`/`transactionReference` on capture)

**Interfaces:**
- Consumes: new columns/enums from B1–B9
- Produces: history row on status change, shipment stamps, payment facts

- [ ] **Step 1: Write failing tests** for each service method
- [ ] **Step 2: Implement** — the logic is in the spec §2.1–2.3
- [ ] **Step 3: Run tests → PASS**
- [ ] **Step 4: Run `./mvnw verify` → PASS**
- [ ] **Step 5: Commit**

---

### Task B11: Backend unit tests for new behaviour

**Files:**
- Create: `OrderStatsServiceTest.java`, `OrderStatusServiceTest.java` (history), `OrderShipmentServiceTest.java`, `PaymentServiceTest.java`

- [ ] **Step 1: Write tests covering** revenue aggregate, history writer, shipment stamps, payment facts
- [ ] **Step 2: Run all backend tests → PASS**
- [ ] **Step 3: Commit**

---

## FRONTEND TASKS

### Task F1: Types — `NOT_COLLECTED` + `StatusKind` + can* helpers

**Files:**
- Modify: `nocteon-dashboard/src/app/features/orders/models/order.model.ts`
- Modify: `nocteon-dashboard/src/app/features/orders/models/order-status.model.ts`
- Modify: `nocteon-dashboard/src/app/shared/ui/status-badge/status-badge.component.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `PaymentStatus` includes `'NOT_COLLECTED'`, `StatusKind` includes `'notCollected'`, `canChangeStatus(order)`, `canCancel(order)`, `canRefund(order)` helpers

- [ ] **Step 1: Add to `order.model.ts`**
```ts
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'NOT_COLLECTED';
export const PAYMENT_STATUSES: readonly PaymentStatus[] = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'NOT_COLLECTED'];
```

- [ ] **Step 2: Add to `order-status.model.ts`**
```ts
export type StatusKind = ... | 'notCollected';

export function paymentStatusKind(status: PaymentStatus): StatusKind {
  switch (status) {
    case 'NOT_COLLECTED': return 'notCollected';
    ...
  }
}

export const STATUS_BADGE_LABELS: Record<StatusKind, string> = {
  ...,
  notCollected: 'common.statuses.notCollected',
};

export const STATUS_BADGE_CLASSES: Record<StatusKind, string> = {
  ...,
  notCollected: 'bg-muted text-muted-foreground',
};

export function effectivePaymentStatus(order: OrderResponse): PaymentStatus {
  if (order.status === 'CANCELLED' && order.paymentMethod === 'CASH_ON_DELIVERY' &&
      (order.paymentStatus === 'PENDING' || order.paymentStatus === 'FAILED')) {
    return 'NOT_COLLECTED';
  }
  return order.paymentStatus;
}
```

- [ ] **Step 3: Update `StatusBadgeComponent`** — the maps are in the component file; add the entries

- [ ] **Step 4: Add i18n keys** (Task F3 covers keys; here just verify TypeScript compiles)

- [ ] **Step 5: Run `ng build` → PASS**

- [ ] **Step 6: Commit**

---

### Task F2: KPI utils — `order-kpi.ts` (pure, unit-tested)

**Files:**
- Create: `nocteon-dashboard/src/app/features/orders/utils/order-kpi.ts`
- Create: `nocteon-dashboard/src/app/features/orders/utils/order-kpi.spec.ts`

**Interfaces:**
- Consumes: `OrderStatsResponse` (with `revenue`, `revenueOrderCount`), `statusCounts`, `filteredTotal`
- Produces:
```ts
export interface KpiValues {
  revenue: number;
  openCount: number;
  avgOrderValue: number;
  cancelRate: number;
}

export function computeKpi(stats: OrderStatsResponse, statusCounts: Record<string,number>, filteredTotal: number): KpiValues;
export function tabToApiParams(tab: OrderStatus | 'ALL' | 'REFUNDED'): { status?: OrderStatus; paymentStatus?: PaymentStatus };
```

- [ ] **Step 1: Write failing tests** (Vitest)
```ts
// order-kpi.spec.ts
test('AOV uses revenueOrderCount, not filteredTotal', () => {
  const stats = { revenue: 1000, revenueOrderCount: 5, ... };
  const kpi = computeKpi(stats, {}, 17);
  expect(kpi.avgOrderValue).toBe(200); // 1000/5, not 1000/17
});

test('cancelRate uses filteredTotal as denominator', () => {
  const kpi = computeKpi({...}, { CANCELLED: 3 }, 15);
  expect(kpi.cancelRate).toBeCloseTo(20); // 3/15*100
});

test('Refunded tab maps to paymentStatus filter', () => {
  expect(tabToApiParams('REFUNDED')).toEqual({ paymentStatus: 'REFUNDED' });
  expect(tabToApiParams('CANCELLED')).toEqual({ status: 'CANCELLED' });
});
```

- [ ] **Step 2: Run test → FAIL**

- [ ] **Step 3: Implement** (pure functions, no Angular deps)
```ts
// order-kpi.ts
export function computeKpi(stats, statusCounts, filteredTotal): KpiValues {
  const revenue = stats.revenue ?? 0;
  const revenueCount = stats.revenueOrderCount ?? 0;
  const openCount = (statusCounts['PENDING']??0)+(statusCounts['CONFIRMED']??0)+(statusCounts['PROCESSING']??0)+(statusCounts['SHIPPED']??0);
  const avgOrderValue = revenueCount > 0 ? revenue / revenueCount : 0;
  const cancelledCount = statusCounts['CANCELLED'] ?? 0;
  const cancelRate = filteredTotal > 0 ? (cancelledCount / filteredTotal) * 100 : 0;
  return { revenue, openCount, avgOrderValue, cancelRate };
}

export function tabToApiParams(tab) {
  if (tab === 'REFUNDED') return { paymentStatus: 'REFUNDED' };
  if (tab === 'ALL') return {};
  return { status: tab as OrderStatus };
}
```

- [ ] **Step 4: Run test → PASS**

- [ ] **Step 5: Run `npm run test:unit` → PASS**

- [ ] **Step 6: Commit**

---

### Task F3: i18n — all EN/AR keys for both pages

**Files:**
- Modify: `nocteon-dashboard/public/assets/i18n/en.json`
- Modify: `nocteon-dashboard/public/assets/i18n/ar.json`

**Keys to add (list is exhaustive — copy from specs §4, §8, §3.3, §6.2, §8.2, §9):**

**Orders list:**
- `orders.stats.revenue`, `orders.stats.avgOrderValue`, `orders.stats.cancelRate`
- `orders.stats.revenueTooltip`, `orders.stats.avgOrderValueTooltip`, `orders.stats.cancelRateTooltip`
- `orders.statusFilter.refunded`, `orders.statusFilter.refundedCount`
- `orders.emptyState.clearFilters`, `orders.emptyState.clearFiltersHint`
- `orders.actions.copyOrderNumber`, `orders.actions.copied`

**Order detail:**
- `orders.detail.copyOrderNumber`, `orders.detail.copied`
- `orders.detail.lifetimeBasis` (already exists), `orders.detail.ordersPlaced`
- `orders.detail.regularPrice`, `orders.detail.regularPriceHint`
- `orders.detail.paymentRefunded`, `orders.detail.paymentRefundedHint`
- `orders.detail.estimatedDeliveryAt`
- `orders.detail.historyMissingBanner` ("Step dates are not recorded...")
- Timeline event titles: `orders.timeline.placed`, `.statusChangedFrom`, `.payment`, `.shipmentShipped`, `.shipmentDelivered`, `.refund`, `.note`, `.by`, `.notify`
- Progress step: `orders.progress.stepCurrent`, `orders.progress.stepDone`, `orders.progress.notRecorded`
- Shipment warning: `orders.detail.shipmentMissingWarning`
- Copy actions: `orders.detail.copyReference`, `orders.detail.copyTracking`, `orders.detail.copyAddress`, `orders.detail.copyLink`

**AR translations** — mirror the EN meaning in Arabic

- [ ] **Step 1: Add all keys to `en.json`**
- [ ] **Step 2: Add all keys to `ar.json`**
- [ ] **Step 3: Verify no raw keys in build** (run dev server, check console)
- [ ] **Step 4: Commit**

---

### Task F4: Orders list component — the scope model + UI

**Files:**
- Modify: `nocteon-dashboard/src/app/features/orders/orders-list/orders-list.component.ts`
- Modify: `nocteon-dashboard/src/app/features/orders/orders-list/orders-list.component.html`

**Interfaces:**
- Consumes: `computeKpi`, `tabToApiParams` (Task F2), `effectivePaymentStatus` (Task F1), i18n (Task F3)
- Produces: the list page with 4 cards, 7 tabs, re-budgeted table

- [ ] **Step 1: Remove the full-read KPI fetch** (the `kpiRows` forkJoin branch in `load()`)
- [ ] **Step 2: Dual stats calls** — `facets` (no status) + `cards` (with status)
- [ ] **Step 3: Four cards** using `computeKpi(cardsStats, statusCounts, pageTotal)`
- [ ] **Step 4: Seven tabs** — All, Pending, Processing, Shipped, Delivered, Cancelled, Refunded
- [ ] **Step 5: Tab click logic** — `Refunded` sets `paymentStatus='REFUNDED'` + disables payment select
- [ ] **Step 6: Table column budgets** — Customer 190px, Created at 124px, total 1176px, `minWidth='1176px'`
- [ ] **Step 7: Customer tooltip** — name + email in tooltip
- [ ] **Step 8: Created at one line** — date in cell, relative time in tooltip
- [ ] **Step 9: Items column** — count via plural pipe, warning icon for empty
- [ ] **Step 10: Zero total warning** — data-issue icon + tooltip
- [ ] **Step 11: NOT_COLLECTED rule** — use `effectivePaymentStatus()` in the payment status column
- [ ] **Step 12: Export CSV** — call `getEveryOrder` with current filters + tab
- [ ] **Step 13: Scope note** — filter-aware (filters? "matching filters" : "every order")
- [ ] **Step 14: Commit**

---

### Task F5: Data table — `emptyAction` opt-in

**Files:**
- Modify: `nocteon-dashboard/src/app/shared/components/data-table/data-table.component.ts`
- Modify: `nocteon-dashboard/src/app/shared/components/data-table/data-table.component.html`

**Interfaces:**
- Consumes: nothing new
- Produces: `emptyAction` input (`{ label: string; action: () => void } | null`) rendered in empty state

- [ ] **Step 1: Add input**
```ts
emptyAction = input<{ label: string; action: () => void } | null>(null);
```

- [ ] **Step 2: Template** — in the empty state `<tr>`, if `emptyAction()` render a button
- [ ] **Step 3: Orders list uses it** — pass `{ label: 'Clear filters', action: clearFilters }`
- [ ] **Step 4: Commit**

---

### Task F6: Status badge — `notCollected` kind

**Files:**
- Modify: `nocteon-dashboard/src/app/shared/ui/status-badge/status-badge.component.ts`

**Interfaces:**
- Consumes: `StatusKind` includes `'notCollected'` (Task F1)
- Produces: badge renders with muted tokens

- [ ] **Step 1: Verify maps have the entry** (added in Task F1)
- [ ] **Step 2: Commit**

---

### Task F7: List E2E — rewrite to new spec

**Files:**
- Modify: `nocteon-dashboard/e2e/orders.spec.ts`
- Modify: `nocteon-dashboard/e2e/orders-states.spec.ts`

**Interfaces:**
- Consumes: the new page behaviour
- Produces: green Playwright suite

- [ ] **Step 1: Update card count expectation** — 4 cards, not 5
- [ ] **Step 2: Update tab expectations** — 7 tabs including Refunded, no Confirmed
- [ ] **Step 3: Add KPI formula tests** — AOV = revenue/revenueCount, cancelRate = cancelled/filteredTotal
- [ ] **Step 4: Add NOT_COLLECTED test** — cancelled COD shows "Not collected"
- [ ] **Step 5: Add ORD-9 test** — total ≠ 0, items shows warning
- [ ] **Step 6: Add export test** — exports filtered+tabbed set, not page
- [ ] **Step 7: Run `npm test` → PASS**
- [ ] **Step 8: Commit**

---

### Task F8: Detail header — state-aware actions

**Files:**
- Modify: `nocteon-dashboard/src/app/features/orders/order-detail/order-detail.component.ts`
- Modify: `nocteon-dashboard/src/app/features/orders/order-detail/order-detail.component.html`

**Interfaces:**
- Consumes: `canChangeStatus`, `canCancel`, `canRefund` (Task F1), `effectivePaymentStatus`
- Produces: header with correct visible actions

- [ ] **Step 1: Remove disabled buttons from kebab** — only render "Cancel"/"Refund" when `canCancel()`/`canRefund()`
- [ ] **Step 2: "Update status" button** — hidden when `statusDisabledReason()` is set
- [ ] **Step 3: Status dropdown** — populate from `nextStatuses(currentStatus)` (already in model)
- [ ] **Step 4: Copy order number** — `copyOrderNumber()` uses `navigator.clipboard.writeText(plainOrderNumber())`
- [ ] **Step 5: Breadcrumb** — order number is copyable (icon on hover)
- [ ] **Step 6: Commit**

---

### Task F9: Timeline — progress tracker + activity log

**Files:**
- Modify: `nocteon-dashboard/src/app/features/orders/components/order-progress/order-progress.component.ts`
- Modify: `nocteon-dashboard/src/app/features/orders/order-detail/order-detail.component.ts` (uses `stepRecords`, `events`, `historyMissing`)

**Interfaces:**
- Consumes: `history[]` from API, `buildOrderEvents` (already exists)
- Produces: progress tracker (steps with recorded dates or "Not recorded"), merged log newest-first

- [ ] **Step 1: Progress tracker** — for each step in `FULFILMENT_CHAIN`, show `stepRecords[step]` date+actor or "Not recorded"
- [ ] **Step 2: Activity log** — `events()` already merges placed/status/payment/shipment/refund/note; verify order
- [ ] **Step 3: Empty history banner** — when `historyMissing()` show "Step dates are not recorded..."
- [ ] **Step 4: Commit**

---

### Task F10: Customer card — customer's own numbers

**Files:**
- Modify: `nocteon-dashboard/src/app/features/orders/order-detail/order-detail.component.ts` (the sidebar customer section)
- Modify: `nocteon-dashboard/src/app/features/orders/order-detail/order-detail.component.html`

**Interfaces:**
- Consumes: `customerSummary` (already computed via `summarizeCustomerOrders`)
- Produces: card showing `orderCount` (all), `lifetimePaid` (PAID only), tooltip with basis

- [ ] **Step 1: Verify tooltip** — `orders.detail.lifetimeBasis` key exists (Task F3)
- [ ] **Step 2: Add "View all orders" link** — `/dashboard/orders?userId={customer.id}`
- [ ] **Step 3: Commit**

---

### Task F11: Items — SKU once, no fake strikethrough

**Files:**
- Modify: `nocteon-dashboard/src/app/features/orders/adapters/order-items.adapter.ts`
- Modify: `nocteon-dashboard/src/app/features/orders/order-detail/order-detail.component.html` (items section)

**Interfaces:**
- Consumes: `view.displaySku`, `view.variantLabel`, `view.item.unitPrice`, `view.item.totalPrice`, `view.originalUnitPrice` (catalog compareAtPrice)
- Produces: correct item rendering

- [ ] **Step 1: Adapter** — `displaySku` = `variant.sku` once; `variantLabel` = translated option values; `originalUnitPrice` = `variant.compareAtPrice` (or null)
- [ ] **Step 2: Template** — remove strikethrough block; show "Regular price" row only when `originalUnitPrice` exists, with tooltip
- [ ] **Step 3: No-items warning** — warning icon + tooltip (already in template, verify)
- [ ] **Step 4: Commit**

---

### Task F12: Totals + Settlement

**Files:**
- Modify: `nocteon-dashboard/src/app/features/orders/order-detail/order-detail.component.html` (totals section)
- Verify: `nocteon-dashboard/src/app/features/orders/utils/order-totals.ts`, `order-settlement.ts` (already correct)

**Interfaces:**
- Consumes: `totals()` (subtotal/discount/shipping/tax/total/consistent), `settlement()` (paid/refunded/balanceDue/incompletePayment/refundedWithoutLine)
- Produces: two stacked tables with warnings only on actual conditions

- [ ] **Step 1: Totals table** — Discount row only when `discount > 0`, Tax row only when `tax > 0`
- [ ] **Step 2: Settlement table** — always shown; `null` → "Not recorded"
- [ ] **Step 3: Warning banners** — only when `settlement.incompletePayment` or `settlement.refundedWithoutLine`
- [ ] **Step 4: Commit**

---

### Task F13: Shipment — read card + ETA dialog

**Files:**
- Modify: `nocteon-dashboard/src/app/features/orders/components/order-shipment-dialog/order-shipment-dialog.component.ts`
- Modify: `nocteon-dashboard/src/app/features/orders/components/order-shipment-dialog/order-shipment-dialog.component.html`
- Modify: `nocteon-dashboard/src/app/features/orders/order-detail/order-detail.component.html` (sidebar shipment section)

**Interfaces:**
- Consumes: `shipment` with `estimatedDeliveryAt` (nullable), `hasShipment()`, `shipmentMissingForStatus()`
- Produces: read card with all fields, edit dialog with ETA date picker

- [ ] **Step 1: Dialog** — add `estimatedDeliveryAt` field (date input), include in `ShipmentDraft`
- [ ] **Step 2: Read card** — show ETA when present
- [ ] **Step 3: Warning** — `shipmentMissingForStatus()` banner on SHIPPED/DELIVERED with no shipment
- [ ] **Step 4: Commit**

---

### Task F14: RTL & states — breadcrumb, skeleton, 404, error, print

**Files:**
- Modify: `nocteon-dashboard/src/app/features/orders/order-detail/order-detail.component.html` (header, breadcrumb)
- Modify: `nocteon-dashboard/src/app/features/orders/order-detail/order-detail.component.css` (print styles)

**Interfaces:**
- Consumes: `language.current()`, `loading()`, `notFound()`, `error()`
- Produces: correct RTL in header/breadcrumb, skeleton for two-column layout, 404 card, error card, print mode (light only)

- [ ] **Step 1: Breadcrumb RTL** — use `dir="rtl"` on breadcrumb container in Arabic, or flex `rtl:row-reverse`
- [ ] **Step 2: Skeleton** — match the two-column grid (`xl:grid-cols-[minmax(0,1fr)_360px]`)
- [ ] **Step 3: 404/Error** — already exist, verify RTL
- [ ] **Step 4: Print** — `enterPrintMode`/`exitPrintMode` already toggle `order-print` class; verify CSS scopes under `html.order-print`
- [ ] **Step 5: Commit**

---

### Task F15: Detail E2E — new spec file

**Files:**
- Create: `nocteon-dashboard/e2e/order-detail.spec.ts`

**Interfaces:**
- Consumes: the new detail page behaviour
- Produces: green Playwright suite covering all states

- [ ] **Step 1: Test scaffold** — login, navigate to `/dashboard/orders/1` (ORD-1 DELIVERED PAID)
- [ ] **Step 2: Header actions** — copy number, print, status dropdown has only allowed, cancel/refund hidden
- [ ] **Step 3: Customer card** — shows 4 orders for Admin, link to user page
- [ ] **Step 4: Items** — SKU once, no strikethrough, variant label
- [ ] **Step 5: Totals + Settlement** — numbers match API, "Not recorded" where appropriate
- [ ] **Step 6: Shipment** — read card + edit dialog with ETA
- [ ] **Step 7: Timeline** — progress tracker with recorded dates, activity log merged
- [ ] **Step 8: States** — Cancelled order (6), Shipped order (8), Refunded order (9)
- [ ] **Step 9: RTL** — switch to Arabic, verify breadcrumb, numbers, icons
- [ ] **Step 10: Run `npm test` → PASS**
- [ ] **Step 11: Commit**

---

## DOCS & EVIDENCE

### Task D1: Update living docs

**Files:**
- Modify: `nocteon-dashboard/API_GAPS.md` (close gaps #1 and #4 for orders)
- Modify: `nocteon-dashboard/DECISIONS.md` (append this phase)
- Modify: `nocteon-dashboard/SEED_PROPOSAL.md` (note the seed fixes)
- Modify: `nocteon-dashboard/e2e/README.md` (update requirement map)

- [ ] **Step 1: Edit each file** with the changes from this phase
- [ ] **Step 2: Commit**

---

### Task D2: Evidence Gate

**Commands:**
```bash
# Backend
cd ../nocteon-backend && ./mvnw verify

# Frontend unit
cd ../nocteon-dashboard && npm run test:unit

# Frontend e2e (needs dev server + backend running)
npm test

# Browser evidence at 1440×900 light/dark EN/AR
# Captured by e2e suite; verify no horizontal scroll, no raw keys

# Evidence Gate
node skills/software-factory/bin/evidence-gate record .quality/runs/<ts>/evidence-manifest.json ...
node skills/software-factory/bin/evidence-gate validate .quality/runs/<ts>/evidence-manifest.json
```

- [ ] **Step 1: Run backend verify → PASS**
- [ ] **Step 2: Run frontend unit → PASS**
- [ ] **Step 3: Run frontend e2e → PASS**
- [ ] **Step 4: Capture browser evidence (4 screenshots × 2 pages = 8 images)**
- [ ] **Step 5: Run Evidence Gate → exit 0**
- [ ] **Step 6: Commit all evidence**

---

## EXECUTION ORDER

```
B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9 → B10 → B11
    (Flyway clean)                              (backend tests)

Then parallel:
F1 → F2 → F3 → F4 → F5 → F6 → F7   (list page)
F1 → F3 → F8 → F9 → F10 → F11 → F12 → F13 → F14 → F15  (detail page)

Then:
D1 → D2
```

Tasks marked with `→` must run sequentially; the two frontend tracks (list + detail) can run in parallel after F1+F3 are done since they only share types and i18n.

---

**Plan complete.** The plan is saved to `docs/superpowers/plans/2026-10-22-orders-list-v4-order-detail-v5.md`.

Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** — A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** — I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end.

**For this plan I recommend Native**, because the tasks are heavily sequential in the backend (each migration depends on the previous) and the frontend tasks share types/i18n — a single context carrying the design decisions is more efficient than spinning up 25+ subagents. A single adversarial review at the end catches cross-task issues.