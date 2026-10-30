import { describe, expect, it } from 'vitest';
import { isProductActive } from './product-status';

/**
 * P6 — the category page read `isActive`, the products list read `active`, and
 * the same four products therefore showed "Disabled" on one page and "Enabled"
 * on the other. These fixtures are the three payload shapes the screens see.
 */
describe('isProductActive', () => {
  it('reads the enabled fixture from the list endpoint (`active`)', () => {
    expect(isProductActive({ active: true })).toBe(true);
  });

  it('reads the disabled fixture as disabled', () => {
    expect(isProductActive({ active: false })).toBe(false);
  });

  it('accepts the alias field (`isActive`)', () => {
    expect(isProductActive({ isActive: true })).toBe(true);
    expect(isProductActive({ isActive: false })).toBe(false);
  });

  it('keeps a product without the flag enabled rather than inventing "disabled"', () => {
    expect(isProductActive({})).toBe(true);
    expect(isProductActive(undefined)).toBe(false);
  });

  it('prefers `active` when both fields disagree', () => {
    expect(isProductActive({ active: true, isActive: false })).toBe(true);
    expect(isProductActive({ active: false, isActive: true })).toBe(false);
  });
});
