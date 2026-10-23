# SEED_PROPOSAL.md — Dashboard Seed Data Improvements

## Overview

This document describes the required changes to the backend seed data to support the dashboard home page requirements. These changes should be implemented in the backend migration files.

## Required Changes

### 1. Extend Orders to Cover Last 75 Days

**Current Issue**: Orders are only seeded for the last 17 hours, which means the previous 30-day period has no data for delta calculations.

**Required Change**: 
- Extend orders to cover the last 75 days with a realistic spread
- Include some days with 0 orders to simulate real-world patterns
- Ensure the previous 30-day period (days 31-60) has meaningful data

**Implementation**:
- Modify `V107__seed_orders_reviews_contacts.sql` to include orders with `created_at` values spread across 75 days
- Use `NOW() - interval 'X days'` with X ranging from 0 to 75
- Include gaps (some days with no orders) for realism

### 2. Fix Order Numbers to Increase with Creation Time

**Current Issue**: Order numbers may not be in chronological order relative to creation time.

**Required Change**:
- Ensure `ORD-YYYY-NNNNNN` increases with creation time (newest = highest number)
- The newest order should have the highest order number

**Implementation**:
- Sort orders by `created_at` before assigning order numbers
- Ensure `ORD-2026-000001` is the oldest order, `ORD-2026-000017` is the newest

### 3. Maintain Required Test Data

**Keep the following requirements**:
- ✅ 2 refunded orders in the current period (ORD-2026-000009 and ORD-2026-000012)
- ✅ At least 1 repeat customer (user_id 1 appears in multiple orders)
- ✅ At least 1 order in Processing status (ORD-2026-000013)
- ✅ At least 1 order in Shipped status (ORD-2026-000008)

### 4. Specific Seed Data Requirements

#### Orders Distribution (75-day span)
```
Days 0-30:  Current period (17 orders)
Days 31-60: Previous period (10-15 orders)
Days 61-75: Older period (5-8 orders)
```

#### Status Distribution
- DELIVERED: 60%
- PROCESSING: 15%
- SHIPPED: 10%
- PENDING: 8%
- CANCELLED: 7%

#### Payment Status Distribution
- PAID: 75%
- PENDING: 15%
- FAILED: 5%
- REFUNDED: 5%

#### Revenue Distribution
- Current period: ~12,000 EGP
- Previous period: ~10,000 EGP
- Delta: ~+20%

### 5. Implementation Notes

**Do NOT run on production data** - These changes are for seed data only.

**Testing Requirements**:
- Verify dashboard shows proper delta calculations
- Ensure previous period has meaningful data
- Confirm order numbers increase chronologically
- Validate refund rate and repeat purchase rate calculations

### 6. Migration Strategy

1. Create new migration file `V116__extend_seed_orders_75_days.sql`
2. Include orders spanning 75 days with realistic distribution
3. Maintain existing order items and payment relationships
4. Ensure order numbers are chronologically assigned

### 7. Verification Queries

After implementation, run these queries to verify:

```sql
-- Check date distribution
SELECT 
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as order_count
FROM orders 
WHERE created_at >= NOW() - interval '75 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day;

-- Check order number sequence
SELECT order_number, created_at 
FROM orders 
ORDER BY created_at;

-- Check refund count in current period
SELECT COUNT(*) 
FROM orders 
WHERE payment_status = 'REFUNDED' 
  AND created_at >= NOW() - interval '30 days';

-- Check repeat customers
SELECT user_id, COUNT(*) as order_count
FROM orders 
GROUP BY user_id 
HAVING COUNT(*) > 1;
```

---

## Implementation Priority

1. **High**: Extend orders to 75-day span
2. **High**: Fix order number chronology
3. **Medium**: Add status/payment distribution
4. **Low**: Add verification queries

---

**Note**: This proposal is for the backend development team to implement. The frontend has been updated to handle the improved data structure.
---

## P1 snapshot — ORD-2026-000001 (before fix)

Captured against the live dev DB (server time `2026-10-23 19:11:55 UTC`).

| Field | Value |
|---|---|
| createdAt | 2026-10-23 06:04:18 UTC |
| paidAt | 2026-10-23 02:04:18 UTC (BEFORE createdAt — broken) |
| confirmedAt | 2026-10-23 07:04:18 UTC |
| processingAt | 2026-10-23 08:04:18 UTC |
| shippedAt | 2026-10-24 06:04:18 UTC (FUTURE — broken) |
| deliveredAt | 2026-10-26 06:04:18 UTC (FUTURE — broken) |
| server now | 2026-10-23 19:11:55 UTC |

Violations: paidAt < createdAt; shippedAt/deliveredAt > now. Order number 000001 is the newest, not the oldest.

## P1 re-run instructions (dev profile only)

- Do NOT run against production data. This seed targets the dev database
  (`nocteon_db` on localhost:5432) only.
- To re-run: execute `V117__reseed_order_timestamps.sql` against the dev DB:
  `PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d nocteon_db -f backend/src/main/resources/db/migration/V117__reseed_order_timestamps.sql`
- The migration is idempotent-ish: it re-spreads the existing 17 orders and
  re-stamps derived timestamps; re-numbering is by createdAt ASC.
- Startup assertion prints `Seed check passed: N orders verified` and throws
  if any order violates createdAt <= paidAt <= shippedAt <= deliveredAt <= now.
- Fixed seed offsets: [74,70,66,62,57,53,48,44,39,35,30,26,21,16,11,6,2] days ago.

---

## Q1 — Real seed code found

### Step 1: grep results
Files matching "PAYMOB-" / "Payment received" / "Shipped to carrier" / "Order confirmed":
- `backend/src/main/java/.../notifications/service/NotificationService.java` (only "Payment received" title, not seed)
- `backend/src/main/resources/db/migration/V107__seed_orders_reviews_contacts.sql` (the real seed: 17 orders + payments + history)
- `backend/src/main/resources/db/migration/V110__order_history_notes_shipment_refunds.sql`
- (dead) `V116__extend_seed_orders_75_days.sql` (never ran — not in flyway_schema_history)
- (dead) `V117__reseed_order_timestamps.sql` (manual patch, removed)

### What actually runs at startup
- **Flyway** (`spring.flyway.enabled=true`, `locations=classpath:db/migration`, `baseline-on-migrate=true`), default profile (no profile-specific config).
- Seed order: V107 (orders/payments/history) → V110 → V115 (spreads dates + stamps derived timestamps after fix).
- V116/V117 were dead duplicates and have been removed.

### Exact reset + re-seed command (dev DB only)
```
docker stop nocteon-app
psql -U postgres -c "DROP DATABASE IF EXISTS nocteon_db; CREATE DATABASE nocteon_db;"
psql -U postgres -d nocteon_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
# run consolidated schema files V4/V7 if needed, then:
java -jar target/nocteon-api-*.jar   # Flyway migrates on startup
```
Or, with the container: rebuild image and `docker compose up`.

### Step 2 changes (V115 rewritten)
- Deterministic day offsets [74,70,66,62,57,53,48,44,39,35,30,26,21,16,11,6,2].
- paidAt (online) = createdAt + 1h; COD paidAt = deliveredAt; shippedAt = createdAt + 8h; deliveredAt = createdAt + 30h.
- "Payment received" event and "Pending -> Confirmed" status event share paidAt.
- Re-numbered by createdAt ASC (oldest = 000001).
- Startup assertion throws on invariant violation or unsorted numbers; logs checked count.

### Step 3: 6 newest orders (DB query, 2026-10-23)
| # | status | createdAt | paidAt | shippedAt | deliveredAt |
|---|--------|-----------|--------|-----------|-------------|
| 12 | CANCELLED | 2026-10-02 | (null/failed) | — | — |
| 13 | PROCESSING | 2026-10-07 | 2026-10-07 +1h | — | — |
| 14 | CANCELLED | 2026-10-12 | — | — | — |
| 15 | CONFIRMED | 2026-10-17 | — | — | — |
| 16 | DELIVERED | 2026-10-21 | 2026-10-21 +1h | +8h | +30h |
| 17 | DELIVERED | 2026-10-23 | 2026-10-23 +1h | +8h | +30h |

UI proof: Delivered order details shows no "Scheduled" badge; Orders list numbers increase with date (newest = highest number). Screenshots: /tmp/scratchpad/q4-timeline.png, /tmp/scratchpad/q2.png.

---

## S1 — All orders after re-seed (dev DB)

| # | status | lines | subtotal | shipping | total |
|---|--------|-------|----------|----------|-------|
| ORD-2026-000001 | DELIVERED | 2 | 1825.00 | 0.00 | 1825.00 |
| ORD-2026-000002 | DELIVERED | 2 | 1889.00 | 0.00 | 1889.00 |
| ORD-2026-000003 | DELIVERED | 2 | 2278.00 | 0.00 | 2278.00 |
| ORD-2026-000004 | DELIVERED | 2 | 1749.00 | 0.00 | 1749.00 |
| ORD-2026-000005 | DELIVERED | 2 | 3657.00 | 0.00 | 3657.00 |
| ORD-2026-000006 | CANCELLED | 1 | 1300.00 | 0.00 | 1300.00 |
| ORD-2026-000007 | CANCELLED | 1 | 2067.00 | 0.00 | 2067.00 |
| ORD-2026-000008 | SHIPPED | 2 | 1604.00 | 0.00 | 1604.00 |
| ORD-2026-000009 | DELIVERED | 2 | 1339.00 | 0.00 | 1339.00 |
| ORD-2026-000010 | CANCELLED | 1 | 1669.50 | 0.00 | 1669.50 |
| ORD-2026-000011 | DELIVERED | 2 | 2004.00 | 0.00 | 2004.00 |
| ORD-2026-000012 | CANCELLED | 1 | 1378.00 | 0.00 | 1378.00 |
| ORD-2026-000013 | PROCESSING | 2 | 1236.00 | 0.00 | 1236.00 |
| ORD-2026-000014 | CANCELLED | 1 | 525.00 | 0.00 | 525.00 |
| ORD-2026-000015 | CONFIRMED | 1 | 1113.00 | 0.00 | 1113.00 |
| ORD-2026-000016 | DELIVERED | 2 | 1934.50 | 0.00 | 1934.50 |
| ORD-2026-000017 | DELIVERED | 2 | 2650.00 | 0.00 | 2650.00 |

All orders: >=1 line, total == subtotal + shipping (shipping 0, all subtotals >= 500 free-shipping threshold). Assertion passed.
