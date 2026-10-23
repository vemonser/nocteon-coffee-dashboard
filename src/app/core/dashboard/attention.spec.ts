import { describe, expect, it } from 'vitest';
import {
  buildAttentionItems,
  openOrdersCount,
  type AttentionCounts,
} from './attention';

const zero: AttentionCounts = {
  pendingOrders: 0,
  confirmedOrders: 0,
  processingOrders: 0,
  shippedOrders: 0,
  unreadMessages: 0,
  pendingReviews: 0,
  lowStock: 0,
  abandonedCarts: 0,
};

describe('openOrdersCount', () => {
  it('counts every non-terminal order status once', () => {
    expect(
      openOrdersCount({
        ...zero,
        pendingOrders: 3,
        confirmedOrders: 4,
        processingOrders: 2,
        shippedOrders: 1,
      }),
    ).toBe(10);
  });

  it('does not include delivered, cancelled or refunded orders', () => {
    // Those statuses are not part of the input at all, so a caller cannot
    // accidentally count them through this function.
    expect(openOrdersCount({ ...zero, shippedOrders: 2 })).toBe(2);
  });
});

describe('buildAttentionItems', () => {
  it('emits ONE open-orders row, never a pending row plus an open row', () => {
    const items = buildAttentionItems({
      ...zero,
      pendingOrders: 10,
      confirmedOrders: 2,
      processingOrders: 6,
      shippedOrders: 4,
    });

    expect(items.filter((i) => i.key === 'needsAttention.openOrders')).toHaveLength(1);
    expect(items.filter((i) => i.key === 'needsAttention.pendingOrders')).toHaveLength(0);
    expect(items[0].count).toBe(22);
    expect(items[0].breakdown).toEqual({ pending: 10, processing: 6, shipped: 4 });
  });

  it('omits zero counts', () => {
    const items = buildAttentionItems({
      ...zero,
      pendingOrders: 1,
      unreadMessages: 0,
      lowStock: 2,
    });

    expect(items.map((i) => i.key)).toEqual([
      'needsAttention.openOrders',
      'needsAttention.lowStock',
    ]);
  });

  it('orders the queue by operational urgency', () => {
    const items = buildAttentionItems({
      ...zero,
      pendingOrders: 1,
      unreadMessages: 2,
      pendingReviews: 3,
      lowStock: 4,
      abandonedCarts: 5,
    });

    expect(items.map((i) => i.key)).toEqual([
      'needsAttention.openOrders',
      'needsAttention.unreadMessages',
      'needsAttention.pendingReviews',
      'needsAttention.lowStock',
      'needsAttention.abandonedCarts',
    ]);
  });

  it('links open orders to the unfiltered list, not to one status', () => {
    const [open] = buildAttentionItems({ ...zero, pendingOrders: 1 });
    // A ?status=PENDING link would show fewer rows than the badge.
    expect(open.link).toBe('/dashboard/orders');
    expect(open.queryParams).toEqual({});
  });

  it('returns no rows when everything is clear', () => {
    expect(buildAttentionItems(zero)).toEqual([]);
  });

  it('never mutates its input', () => {
    const counts = { ...zero, unreadMessages: 3 };
    buildAttentionItems(counts);
    expect(counts.unreadMessages).toBe(3);
  });
});
