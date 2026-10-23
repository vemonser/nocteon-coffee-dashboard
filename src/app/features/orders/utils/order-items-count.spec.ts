import { describe, it, expect } from 'vitest';
import { orderItemsCount, orderLinesCount } from './order-items-count';

describe('orderItemsCount', () => {
  it('returns 0 for null order', () => {
    expect(orderItemsCount(null)).toBe(0);
  });

  it('returns 0 for order without items', () => {
    expect(orderItemsCount({})).toBe(0);
  });

  it('sums quantities', () => {
    const order = { items: [{ quantity: 2 }, { quantity: 3 }] };
    expect(orderItemsCount(order)).toBe(5);
  });

  it('defaults quantity to 1', () => {
    const order = { items: [{}, { quantity: 2 }] };
    expect(orderItemsCount(order)).toBe(3);
  });
});

describe('orderLinesCount', () => {
  it('returns 0 for null order', () => {
    expect(orderLinesCount(null)).toBe(0);
  });

  it('returns number of lines', () => {
    const order = { items: [{}, {}, {}] };
    expect(orderLinesCount(order)).toBe(3);
  });
});