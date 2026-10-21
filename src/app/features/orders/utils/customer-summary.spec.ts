import { describe, expect, it } from 'vitest';
import { summarizeCustomerOrders } from './customer-summary';
import type { OrderResponse } from '../models/order.model';

function order(id: number, totalAmount: number, paymentStatus: OrderResponse['paymentStatus']): OrderResponse {
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
  };
}

describe('summarizeCustomerOrders', () => {
  it('counts every order but sums only the PAID ones', () => {
    const summary = summarizeCustomerOrders([
      order(1, 1000, 'PAID'),
      order(2, 500, 'PAID'),
      order(3, 900, 'REFUNDED'),
      order(4, 50, 'PENDING'),
    ]);
    expect(summary.orderCount).toBe(4);
    expect(summary.paidOrderCount).toBe(2);
    expect(summary.lifetimePaid).toBe(1500);
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
