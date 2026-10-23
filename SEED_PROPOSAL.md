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