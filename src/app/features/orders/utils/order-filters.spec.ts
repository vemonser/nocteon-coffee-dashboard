import { describe, expect, it } from 'vitest';
import {
  applyFilters,
  countByPaymentMethod,
  countByPaymentStatus,
  countByStatus,
  matchesRange,
  matchesSearch,
  rangeWindow,
  type OrderFilters,
} from './order-filters';
import type { OrderResponse } from '../models/order.model';

/**
 * Phase 1, ticket 1.2 / Phase 6, ticket 6.3 — the filters the API does not
 * support, applied over the whole set.
 *
 * The day boundary is pinned here: an order placed at 23:30 belongs to THAT
 * calendar day, in the store's time zone. The seed data has no 23:30 order
 * (see ORDERS_SEED_PROPOSAL.md), so the rule is proved on the logic.
 */

function order(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: 1,
    orderNumber: 'ORD-2026-000001',
    status: 'PENDING',
    totalAmount: 100,
    paymentStatus: 'PAID',
    paymentMethod: 'ONLINE',
    shippingCost: 0,
    discountAmount: 0,
    notes: null,
    items: [],
    createdAt: '2026-10-20T12:00:00Z',
    ...overrides,
  };
}

const FILTERS: OrderFilters = {
  paymentStatus: 'ALL',
  paymentMethod: 'ALL',
  range: 'all',
  from: null,
  to: null,
  search: '',
};

describe('the date range', () => {
  const now = new Date(2026, 9, 20, 12, 0); // 20 Oct 2026, 12:00 local

  it('"today" is the calendar day, not the last 24 hours', () => {
    expect(rangeWindow('today', null, null, now)).toEqual({
      start: '2026-10-20',
      end: '2026-10-20',
    });
  });

  it('"7d" is seven calendar days, ending today', () => {
    expect(rangeWindow('7d', null, null, now)).toEqual({
      start: '2026-10-14',
      end: '2026-10-20',
    });
  });

  it('"30d" is thirty calendar days, ending today', () => {
    expect(rangeWindow('30d', null, null, now)).toEqual({
      start: '2026-09-21',
      end: '2026-10-20',
    });
  });

  it('"all" covers everything', () => {
    expect(rangeWindow('all', null, null, now)).toBeNull();
  });

  it('a custom range is inclusive on both ends', () => {
    expect(rangeWindow('custom', '2026-10-01', '2026-10-05', now)).toEqual({
      start: '2026-10-01',
      end: '2026-10-05',
    });
  });

  it('an order placed at 23:30 belongs to THAT day', () => {
    const window = rangeWindow('today', null, null, now);
    // 20 Oct 2026, 23:30 local.
    const late = new Date(2026, 9, 20, 23, 30).toISOString();
    expect(matchesRange(late, window)).toBe(true);

    // 21 Oct 2026, 00:30 local — the next day, and NOT today.
    const justAfter = new Date(2026, 9, 21, 0, 30).toISOString();
    expect(matchesRange(justAfter, window)).toBe(false);
  });

  it('an order placed at 00:30 belongs to the new day', () => {
    const window = rangeWindow('today', null, null, new Date(2026, 9, 21, 12, 0));
    const justAfter = new Date(2026, 9, 21, 0, 30).toISOString();
    expect(matchesRange(justAfter, window)).toBe(true);
    const late = new Date(2026, 9, 20, 23, 30).toISOString();
    expect(matchesRange(late, window)).toBe(false);
  });

  it('an order with no date is outside every range', () => {
    expect(matchesRange(null, rangeWindow('today', null, null, now))).toBe(false);
  });
});

describe('the search', () => {
  const o = order({
    orderNumber: 'ORD-2026-000042',
    customer: { id: 9, name: 'Sara Khaled', email: 'sara@example.com' },
    address: {
      id: 1,
      fullName: 'Sara Khaled',
      phone: '+20 100 123 4567',
      street: 'Smart Village',
      city: 'Giza',
      state: 'Giza',
      country: 'Egypt',
      postalCode: '12577',
      isDefault: true,
    },
  });

  it('matches the order number', () => {
    expect(matchesSearch(o, '000042')).toBe(true);
    expect(matchesSearch(o, 'ORD-2026')).toBe(true);
  });

  it('matches the customer name', () => {
    expect(matchesSearch(o, 'sara')).toBe(true);
    expect(matchesSearch(o, 'Khaled')).toBe(true);
  });

  it('matches the e-mail', () => {
    expect(matchesSearch(o, 'sara@example')).toBe(true);
  });

  it('matches the phone', () => {
    expect(matchesSearch(o, '123 4567')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(matchesSearch(o, 'SARA@EXAMPLE.COM')).toBe(true);
  });

  it('matches everything when the term is empty', () => {
    expect(matchesSearch(o, '')).toBe(true);
    expect(matchesSearch(o, '   ')).toBe(true);
  });

  it('matches nothing when the term is absent', () => {
    expect(matchesSearch(o, 'zzzz')).toBe(false);
  });
});

describe('applyFilters', () => {
  const orders = [
    order({ id: 1, paymentStatus: 'PAID', paymentMethod: 'ONLINE', status: 'DELIVERED' }),
    order({ id: 2, paymentStatus: 'FAILED', paymentMethod: 'CASH_ON_DELIVERY', status: 'CANCELLED' }),
    order({ id: 3, paymentStatus: 'PAID', paymentMethod: 'CASH_ON_DELIVERY', status: 'SHIPPED' }),
  ];

  it('returns everything when no filter is set', () => {
    expect(applyFilters(orders, FILTERS)).toHaveLength(3);
  });

  it('filters by the payment status', () => {
    expect(applyFilters(orders, { ...FILTERS, paymentStatus: 'PAID' })).toHaveLength(2);
  });

  it('filters by the payment method', () => {
    expect(
      applyFilters(orders, { ...FILTERS, paymentMethod: 'CASH_ON_DELIVERY' }),
    ).toHaveLength(2);
  });

  it('combines the filters', () => {
    expect(
      applyFilters(orders, {
        ...FILTERS,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH_ON_DELIVERY',
      }),
    ).toHaveLength(1);
  });

  it('can return nothing', () => {
    expect(applyFilters(orders, { ...FILTERS, search: 'nothing' })).toHaveLength(0);
  });
});

describe('the counts', () => {
  const orders = [
    order({ id: 1, status: 'DELIVERED', paymentStatus: 'PAID', paymentMethod: 'ONLINE' }),
    order({ id: 2, status: 'DELIVERED', paymentStatus: 'PAID', paymentMethod: 'ONLINE' }),
    order({ id: 3, status: 'CANCELLED', paymentStatus: 'FAILED', paymentMethod: 'ONLINE' }),
  ];

  it('counts the orders per status', () => {
    expect(countByStatus(orders)).toEqual({ DELIVERED: 2, CANCELLED: 1 });
  });

  it('counts the orders per payment status', () => {
    expect(countByPaymentStatus(orders)).toEqual({ PAID: 2, FAILED: 1 });
  });

  it('counts the orders per payment method', () => {
    expect(countByPaymentMethod(orders)).toEqual({ ONLINE: 3 });
  });
});
