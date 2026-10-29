import { describe, expect, it } from 'vitest';
import { buildOrderItemViews, type VariantInfo } from './order-items.adapter';
import type { OrderItemResponse } from '../models/order.model';

function item(overrides: Partial<OrderItemResponse> = {}): OrderItemResponse {
  return {
    id: 1,
    variantId: 1,
    sku: 'SKU-1-1',
    productSlug: 'ethiopia-yirgacheffe',
    productName: 'Ethiopia Yirgacheffe',
    primaryImageUrl: null,
    quantity: 2,
    unitPrice: 650,
    totalPrice: 1300,
    ...overrides,
  };
}

const variant: VariantInfo = {
  id: 1,
  sku: 'SKU-1-1',
  compareAtPrice: 747.5,
  stockQuantity: 12,
  attributes: [
    { name: 'Weight', value: '250g' },
    { name: 'Grind Type', value: 'Whole Bean' },
  ],
};

describe('buildOrderItemViews', () => {
  it('joins the line to its variant and labels the options', () => {
    const [view] = buildOrderItemViews([item()], new Map([[1, variant]]));
    expect(view.variant).toBe(variant);
    expect(view.variantLabel).toBe('250g · Whole Bean');
    expect(view.originalUnitPrice).toBe(747.5);
  });

  it('shows no struck-through price when the catalog has no compare-at', () => {
    const [view] = buildOrderItemViews(
      [item()],
      new Map([[1, { ...variant, compareAtPrice: null }]]),
    );
    expect(view.originalUnitPrice).toBeNull();
  });

  it('does not strike a compare-at price that is below the paid unit price', () => {
    const [view] = buildOrderItemViews(
      [item({ unitPrice: 800, totalPrice: 1600 })],
      new Map([[1, variant]]),
    );
    expect(view.originalUnitPrice).toBeNull();
  });

  it('renders the line when the catalog could not be resolved', () => {
    const [view] = buildOrderItemViews([item()], new Map());
    expect(view.variant).toBeNull();
    expect(view.variantLabel).toBeNull();
    expect(view.item.sku).toBe('SKU-1-1');
  });

  it('prefers the catalog variant SKU over the order line SKU', () => {
    const variantWithSku: VariantInfo = { ...variant, sku: 'SKU-001' };
    const [view] = buildOrderItemViews([item()], new Map([[1, variantWithSku]]));
    expect(view.displaySku).toBe('SKU-001');
  });

  it('falls back to the order line SKU when the variant is absent', () => {
    const [view] = buildOrderItemViews([item()], new Map());
    expect(view.displaySku).toBe('SKU-1-1');
  });

  it('falls back to the order line SKU when the variant has no SKU', () => {
    const variantNoSku: VariantInfo = { ...variant, sku: null };
    const [view] = buildOrderItemViews([item()], new Map([[1, variantNoSku]]));
    expect(view.displaySku).toBe('SKU-1-1');
  });
});
