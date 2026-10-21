import { describe, expect, it } from 'vitest';
import { computeSettlement } from './order-settlement';
import type { OrderResponse } from '../models/order.model';
import type { OrderPaymentDetails } from '../models/order-activity.model';

function order(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: 30,
    orderNumber: 'ORD-2026-000030',
    status: 'DELIVERED',
    totalAmount: 1000,
    paymentStatus: 'PAID',
    paymentMethod: 'ONLINE',
    shippingCost: 50,
    discountAmount: 0,
    notes: null,
    items: [],
    createdAt: '2026-10-20T08:49:48Z',
    ...overrides,
  };
}

function payment(overrides: Partial<OrderPaymentDetails> = {}): OrderPaymentDetails {
  return {
    method: 'ONLINE',
    status: 'PAID',
    transactionReference: 'TXN-1',
    paidAt: '2026-10-20T09:00:00Z',
    amount: 1000,
    netPaid: 1000,
    refunds: [],
    ...overrides,
  };
}

describe('computeSettlement', () => {
  it('reads a complete online payment', () => {
    const s = computeSettlement(order(), payment());
    expect(s.paid).toBe(1000);
    expect(s.refunded).toBe(0);
    expect(s.balanceDue).toBe(0);
    expect(s.incompletePayment).toBe(false);
  });

  it('flags a PAID order with no paid-at and no reference', () => {
    const s = computeSettlement(
      order(),
      payment({ paidAt: null, transactionReference: null }),
    );
    expect(s.missingPaidAt).toBe(true);
    expect(s.missingReference).toBe(true);
    expect(s.incompletePayment).toBe(true);
    // Still reports what was recorded — the amount is not part of the warning.
    expect(s.paid).toBe(1000);
  });

  it('does not demand a gateway reference for cash on delivery', () => {
    const s = computeSettlement(
      order({ paymentMethod: 'CASH_ON_DELIVERY' }),
      payment({ method: 'CASH_ON_DELIVERY', paidAt: '2026-10-20T18:00:00Z', transactionReference: null }),
    );
    expect(s.missingReference).toBe(false);
    expect(s.incompletePayment).toBe(false);
  });

  it('leaves a REFUNDED order with no refund line unknown, never zero', () => {
    const s = computeSettlement(
      order({ paymentStatus: 'REFUNDED', totalAmount: 0 }),
      payment({ status: 'REFUNDED', amount: 0, paidAt: null, transactionReference: null }),
    );
    expect(s.refunded).toBeNull();
    expect(s.refundedWithoutLine).toBe(true);
    expect(s.balanceDue).toBeNull();
  });

  it('subtracts recorded refunds from what was paid', () => {
    const s = computeSettlement(
      order({ paymentStatus: 'REFUNDED' }),
      payment({
        status: 'REFUNDED',
        amount: 600,
        refunds: [
          { id: 1, orderId: 30, amount: 400, reason: 'damaged', createdBy: 'admin', manual: false, gatewayReference: null, createdAt: '2026-10-21T08:00:00Z' },
        ],
      }),
    );
    expect(s.refunded).toBe(400);
    expect(s.balanceDue).toBe(0);
  });

  it('leaves the refunds unknown until the payment detail has loaded', () => {
    // `payment()` is null while the activity request is in flight (and if it
    // failed). Rendering 0 here would claim nothing was ever refunded.
    const s = computeSettlement(order({ paymentStatus: 'PAID' }), null);
    expect(s.refunded).toBeNull();
    expect(s.balanceDue).toBeNull();
  });

  it('owes the total on an unpaid order, and nothing on a cancelled one', () => {
    expect(computeSettlement(order({ paymentStatus: 'PENDING' }), null).balanceDue).toBe(1000);
    expect(
      computeSettlement(order({ status: 'CANCELLED', paymentStatus: 'FAILED' }), null).balanceDue,
    ).toBe(0);
  });

  it('handles no order at all', () => {
    const s = computeSettlement(null, null);
    expect(s.paid).toBe(0);
    // No order means no payment detail either: the refunded amount is unknown,
    // not zero.
    expect(s.refunded).toBeNull();
    expect(s.balanceDue).toBeNull();
    expect(s.incompletePayment).toBe(false);
  });
});
