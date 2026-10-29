import { describe, expect, it } from 'vitest';
import { canAdjust, parseDelta, previewStock } from './stock-adjustment';

describe('stock adjustment rules', () => {
  it('reads a delta, and answers null for an empty or unusable field', () => {
    expect(parseDelta(5)).toBe(5);
    expect(parseDelta('-3')).toBe(-3);
    expect(parseDelta(null)).toBeNull();
    expect(parseDelta('')).toBeNull();
    expect(parseDelta('abc')).toBeNull();
  });

  it('previews the stock after the change', () => {
    expect(previewStock(10, 5)).toBe(15);
    expect(previewStock(10, -4)).toBe(6);
  });

  it('refuses to preview a zero change or a result below zero', () => {
    expect(previewStock(10, 0)).toBeNull();
    expect(previewStock(10, null)).toBeNull();
    expect(previewStock(3, -4)).toBeNull();
    // landing exactly on zero is allowed: the shelf can be empty.
    expect(previewStock(3, -3)).toBe(0);
  });

  it('keeps Save disabled until there is a change AND a reason', () => {
    expect(canAdjust(10, 5, '', false)).toBe(false);
    expect(canAdjust(10, 5, '   ', false)).toBe(false);
    expect(canAdjust(10, null, 'restock', false)).toBe(false);
    expect(canAdjust(10, 0, 'restock', false)).toBe(false);
    expect(canAdjust(3, -4, 'shrinkage', false)).toBe(false);
    expect(canAdjust(10, 5, '24 units arrived', false)).toBe(true);
    expect(canAdjust(10, -2, 'damaged', false)).toBe(true);
  });

  it('cannot be pressed twice while a save is in flight', () => {
    expect(canAdjust(10, 5, 'restock', true)).toBe(false);
  });
});
