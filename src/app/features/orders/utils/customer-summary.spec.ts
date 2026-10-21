import { describe, expect, it } from 'vitest';
import { summarizeCustomerOrders } from './customer-summary';
import type { OrderResponse } from '../models/order.model';

function order(id: number, totalAmount: number, paymentStatus: OrderResponse['paymentStatus'], customerId?: number): OrderResponse {
  return {
    id,
    orderNumber: `ORD-2026-${String(id).padStart(6, '0')}`,
    status: 'DELIVERED',
    totalAmount,
    paymentStatus,
    paymentMethod: 'ONLINE',
    shippingCost: 0,
    discountAmount: 0,
    notes: null,
    items: [],
    createdAt: '2026-10-20T05:49:48Z',
    customer: customerId ? { id: customerId, name: `Customer ${customerId}`, email: `c${customerId}@example.com` } : undefined,
  };
}

describe('summarizeCustomerOrders', () => {
  it('counts every order but sums only the PAID ones', () => {
    const summary = summarizeCustomerOrders([
      order(1, 1000, 'PAID', 1),
      order(2, 500, 'PAID', 1),
      order(3, 900, 'REFUNDED', 1),
      order(4, 50, 'PENDING', 1),
    ]);
    expect(summary.orderCount).toBe(4);
    expect(summary.paidOrderCount).toBe(2);
    expect(summary.lifetimePaid).toBe(1500);
  });

  it('filters to a single customer before summarising (multi-customer fixture)', () => {
    // Simulates the client-side userId filter: the backend ignores userId and
    // returns all orders. The page filters by customer.id before summarising.
    const allOrders = [
      order(1, 1000, 'PAID', 1),    // customer 1
      order(2, 500, 'PAID', 2),     // customer 2
      order(3, 900, 'REFUNDED', 2), // customer 2
      order(4, 50, 'PENDING', 1),   // customer 1
    ];
    const customerId = 1;
    const filtered = allOrders.filter((o) => o.customer?.id === customerId);
    const summary = summarizeCustomerOrders(filtered);
    // Only orders 1 and 4 belong to customer 1.
    expect(summary.orderCount).toBe(2);
    expect(summary.paidOrderCount).toBe(1);
    expect(summary.lifetimePaid).toBe(1000);
  });

  it('rounds the sum to two decimals', () => {
    const summary = summarizeCustomerOrders([order(1, 0.1, 'PAID'), order(2, 0.2, 'PAID')]);
    expect(summary.lifetimePaid).toBe(0.3);
  });

  it('handles a customer with no orders', () => {
    expect(summarizeCustomerOrders([])).toEqual({
      orderCount: 0,
      paidOrderCount: 0,
      lifetimePaid: 0,
    });
  });
});
