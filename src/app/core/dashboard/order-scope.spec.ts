import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_ORDER_SCOPE,
  ORDER_COUNT_SCOPES,
  ORDER_SCOPE_EXCLUDED_PAYMENT_STATUSES,
  ORDERS_LIST_SCOPE,
  orderScopeDefinition,
} from './order-scope';

/**
 * The order-count scope (Round 2, ticket 1.2).
 *
 * The dashboard said "10 orders" and the Orders page said "17 orders", and
 * both numbers were right — they counted different things.
 */
describe('the order-count scope', () => {
  it('has exactly two scopes, and no third meaning may be invented', () => {
    expect(Object.keys(ORDER_COUNT_SCOPES).sort()).toEqual(['all', 'paid']);
  });

  it('the dashboard counts the paid orders and the page counts every order', () => {
    expect(DASHBOARD_ORDER_SCOPE).toBe('paid');
    expect(ORDERS_LIST_SCOPE).toBe('all');
  });

  it('names the PAYMENT statuses it leaves out, not the order statuses', () => {
    // A cancelled order can be refunded, and a delivered order can be
    // refunded — so naming the order statuses would be wrong twice over.
    expect(ORDER_SCOPE_EXCLUDED_PAYMENT_STATUSES).toEqual([
      'PENDING',
      'FAILED',
      'REFUNDED',
    ]);
    expect(ORDER_SCOPE_EXCLUDED_PAYMENT_STATUSES).not.toContain('CANCELLED');
    expect(ORDER_SCOPE_EXCLUDED_PAYMENT_STATUSES).not.toContain('DELIVERED');
  });

  it('every scope has a label and a help text, and they are different keys', () => {
    for (const scope of Object.values(ORDER_COUNT_SCOPES)) {
      expect(scope.labelKey).toMatch(/\./);
      expect(scope.helpKey).toMatch(/\./);
      expect(scope.labelKey).not.toBe(scope.helpKey);
    }
  });

  it('the two scopes do not share a key — a shared key would print the same sentence twice', () => {
    expect(ORDER_COUNT_SCOPES.paid.labelKey).not.toBe(ORDER_COUNT_SCOPES.all.labelKey);
    expect(ORDER_COUNT_SCOPES.paid.helpKey).not.toBe(ORDER_COUNT_SCOPES.all.helpKey);
  });

  it('the surfaces read the definition through the helper, not a literal', () => {
    expect(orderScopeDefinition(DASHBOARD_ORDER_SCOPE)).toBe(ORDER_COUNT_SCOPES.paid);
    expect(orderScopeDefinition(ORDERS_LIST_SCOPE)).toBe(ORDER_COUNT_SCOPES.all);
  });
});
