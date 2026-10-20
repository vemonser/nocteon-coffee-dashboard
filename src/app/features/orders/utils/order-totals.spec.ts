import { describe, expect, it } from 'vitest';
import { computeOrderTotals, lineTotalsAgree, money2 } from './order-totals';
import type { OrderResponse } from '../models/order.model';

/**
 * Phase 1, ticket 1.1 — the totals breakdown.
 *
 * The backend owns the total. These tests pin the DISPLAY contract: what the
 * UI shows for every shape an order can have, and — the point of the whole
 * exercise — that a stored total which disagrees with its own items is
 * REPORTED, never quietly replaced by a re-derived number.
 */

function order(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: 1,
    orderNumber: 'ORD-2026-000001',
    status: 'PENDING',
    totalAmount: 0,
    paymentStatus: 'PENDING',
    paymentMethod: 'ONLINE',
    shippingCost: 0,
    discountAmount: 0,
    notes: null,
    items: [],
    createdAt: '2026-10-20T08:49:48Z',
    ...overrides,
  };
}

const item = (over: Partial<OrderResponse['items'][number]> = {}) => ({
  id: 1,
  variantId: 1,
  sku: 'SKU-1',
  productSlug: 'ethiopia',
  productName: 'Ethiopia Yirgacheffe',
  primaryImageUrl: null,
  quantity: 1,
  unitPrice: 100,
  totalPrice: 100,
  ...over,
});

describe('computeOrderTotals', () => {
  it('reports an empty order without inventing a total', () => {
    const t = computeOrderTotals(order());
    expect(t.subtotal).toBe(0);
    expect(t.shipping).toBe(0);
    expect(t.discount).toBe(0);
    expect(t.tax).toBe(0);
    expect(t.total).toBe(0);
    expect(t.expectedTotal).toBe(0);
    expect(t.consistent).toBe(true);
  });

  it('handles a null order', () => {
    const t = computeOrderTotals(null);
    expect(t.total).toBe(0);
    expect(t.consistent).toBe(true);
    expect(t.netPaid).toBe(0);
  });

  it('sums the item line totals into the subtotal', () => {
    const t = computeOrderTotals(
      order({
        items: [item({ id: 1, unitPrice: 650, totalPrice: 1300, quantity: 2 }), item({ id: 2, unitPrice: 525, totalPrice: 525, quantity: 1 })],
        shippingCost: 50,
        totalAmount: 1875,
      }),
    );
    expect(t.subtotal).toBe(1825);
    expect(t.shipping).toBe(50);
    expect(t.discount).toBe(0);
    expect(t.tax).toBe(0);
    expect(t.total).toBe(1875);
    expect(t.expectedTotal).toBe(1875);
    expect(t.consistent).toBe(true);
    expect(t.delta).toBe(0);
  });

  it('applies the discount before the shipping', () => {
    const t = computeOrderTotals(
      order({
        items: [item({ unitPrice: 100, totalPrice: 300, quantity: 3 })],
        discountAmount: 50,
        shippingCost: 50,
        totalAmount: 300,
      }),
    );
    expect(t.subtotal).toBe(300);
    expect(t.discount).toBe(50);
    expect(t.expectedTotal).toBe(300); // 300 - 50 + 50
    expect(t.total).toBe(300);
    expect(t.consistent).toBe(true);
  });

  it('reports a stored total that disagrees with the items', () => {
    // The real ORD-2026-000001: the items are 1825 + 50 shipping, but the
    // stored total is 120.50 (the seed wrote it by hand).
    const t = computeOrderTotals(
      order({
        items: [item({ id: 1, unitPrice: 650, totalPrice: 1300, quantity: 2 }), item({ id: 2, unitPrice: 525, totalPrice: 525, quantity: 1 })],
        shippingCost: 50,
        totalAmount: 120.5,
      }),
    );
    expect(t.total).toBe(120.5);
    expect(t.subtotal).toBe(1825);
    expect(t.expectedTotal).toBe(1875);
    expect(t.consistent).toBe(false);
    expect(t.delta).toBe(-1754.5);
    // The stored total is still the number of record — the UI shows it AND
    // says the items do not add up to it.
    expect(t.total).not.toBe(t.expectedTotal);
  });

  it('keeps the stored total as the displayed total even when it disagrees', () => {
    const t = computeOrderTotals(order({ items: [item()], totalAmount: 999 }));
    expect(t.total).toBe(999);
  });

  it('reports a free-shipping order (shipping 0)', () => {
    const t = computeOrderTotals(
      order({ items: [item({ unitPrice: 100, totalPrice: 100 })], shippingCost: 0, totalAmount: 100 }),
    );
    expect(t.shipping).toBe(0);
    expect(t.expectedTotal).toBe(100);
    expect(t.consistent).toBe(true);
  });

  it('reports a paid order net paid as the total', () => {
    const t = computeOrderTotals(
      order({ items: [item()], totalAmount: 100, paymentStatus: 'PAID' }),
    );
    expect(t.netPaid).toBe(100);
    expect(t.refundAmountUnknown).toBe(false);
  });

  it('reports net paid as UNKNOWN for a refunded order (no refund amount exists)', () => {
    const t = computeOrderTotals(
      order({ items: [item()], totalAmount: 200, paymentStatus: 'REFUNDED' }),
    );
    expect(t.refundAmountUnknown).toBe(true);
    // NOT 0 — claiming a full refund would be a lie.
    expect(t.netPaid).toBeNull();
  });

  it('has no tax, because the backend has no tax concept', () => {
    const t = computeOrderTotals(order({ items: [item()], totalAmount: 100 }));
    expect(t.tax).toBe(0);
  });

  it('is stable against floating point noise', () => {
    const t = computeOrderTotals(
      order({
        items: [item({ unitPrice: 0.1, totalPrice: 0.3, quantity: 3 })],
        shippingCost: 0,
        totalAmount: 0.3,
      }),
    );
    expect(t.subtotal).toBe(0.3);
    expect(t.expectedTotal).toBe(0.3);
    expect(t.consistent).toBe(true);
  });
});

describe('lineTotalsAgree', () => {
  it('is true when every line total equals unit price x quantity', () => {
    expect(lineTotalsAgree(order({ items: [item({ unitPrice: 10, quantity: 3, totalPrice: 30 })] }))).toBe(true);
  });

  it('is false when a line total disagrees with its own price and quantity', () => {
    expect(lineTotalsAgree(order({ items: [item({ unitPrice: 10, quantity: 3, totalPrice: 31 })] }))).toBe(false);
  });

  it('is true for an order with no items', () => {
    expect(lineTotalsAgree(order())).toBe(true);
  });
});

describe('money2', () => {
  it('rounds to two decimals without float noise', () => {
    expect(money2(0.1 + 0.2)).toBe(0.3);
    expect(money2(1825.005)).toBe(1825.01);
    expect(money2(-0.005)).toBe(0);
  });
});
