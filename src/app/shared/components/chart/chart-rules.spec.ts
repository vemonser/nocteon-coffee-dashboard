import { describe, expect, it } from 'vitest';
import {
  CATEGORICAL,
  chartKindFor,
  MAX_DONUT_SLICES,
  MIN_DONUT_PX,
  MIN_DONUT_SLICES,
  OTHER,
  SEQUENTIAL,
  SINGLE_SERIES,
  STATUS_COLORS,
  percentOf,
  sliceColors,
  statusColor,
  withPercents,
} from './chart-rules';

describe('chart type rules', () => {
  it('one slice (or none) is a stat, never a chart', () => {
    expect(chartKindFor(0, 400)).toBe('stat');
    expect(chartKindFor(1, 400)).toBe('stat');
  });

  it('two slices are bars, not a donut', () => {
    expect(chartKindFor(2, 400)).toBe('bars');
  });

  it('three to five slices are a donut', () => {
    for (const n of [MIN_DONUT_SLICES, 4, MAX_DONUT_SLICES]) {
      expect(chartKindFor(n, 400)).toBe('donut');
    }
  });

  it('six or more slices are bars', () => {
    expect(chartKindFor(6, 400)).toBe('bars');
    expect(chartKindFor(12, 400)).toBe('bars');
  });

  it('a donut smaller than the minimum is bars', () => {
    expect(chartKindFor(4, MIN_DONUT_PX - 1)).toBe('bars');
    expect(chartKindFor(4, MIN_DONUT_PX)).toBe('donut');
  });
});

describe('palette', () => {
  it('a single series uses the first colour', () => {
    expect(sliceColors(1, 'single')).toEqual([SINGLE_SERIES]);
    expect(SINGLE_SERIES).toBe(CATEGORICAL[0]);
  });

  it('the categorical palette has six distinct tokens', () => {
    expect(CATEGORICAL.length).toBe(6);
    expect(new Set(CATEGORICAL).size).toBe(6);
  });

  it('the sequential ramp is distinct from the categorical set', () => {
    expect(SEQUENTIAL.length).toBe(4);
    for (const c of SEQUENTIAL) expect(CATEGORICAL).not.toContain(c);
  });

  it('the "Other" bucket is neutral, not a category colour', () => {
    expect(OTHER).not.toBe(CATEGORICAL[0]);
    expect(CATEGORICAL).not.toContain(OTHER);
  });

  it('an order status uses a SEMANTIC colour, never a categorical one', () => {
    expect(STATUS_COLORS.DELIVERED).toBe('var(--status-delivered)');
    expect(STATUS_COLORS.PROCESSING).toBe('var(--status-processing)');
    expect(STATUS_COLORS.SHIPPED).toBe('var(--status-shipped)');
    expect(STATUS_COLORS.PENDING).toBe('var(--status-pending)');
    expect(STATUS_COLORS.CANCELLED).toBe('var(--status-cancelled)');
    expect(STATUS_COLORS.REFUNDED).toBe('var(--status-refunded)');
    for (const color of Object.values(STATUS_COLORS)) {
      expect(CATEGORICAL.slice(0, 4)).not.toContain(color);
      // A status swatch is never one of the chart tokens: that is how a
      // shipped slice ended up being the same colour as a possible origin
      // slice.
      expect(color).not.toMatch(/var\(--chart-/);
      expect(color).not.toMatch(/var\(--roast-/);
    }
  });

  it('an unknown status falls back to the neutral token', () => {
    expect(statusColor('WHATEVER')).toBe(OTHER);
    expect(statusColor('delivered')).toBe(STATUS_COLORS.DELIVERED);
  });
});

describe('percentages', () => {
  it('computes a share of the total', () => {
    expect(percentOf(50, 200)).toBe(25);
    expect(percentOf(1, 3)).toBe(33.3);
  });

  it('an empty total gives 0, never NaN', () => {
    expect(percentOf(10, 0)).toBe(0);
    expect(Number.isNaN(percentOf(10, 0))).toBe(false);
  });

  it('sorts the slices by value, with "Other" last', () => {
    const prepared = withPercents([
      { label: 'small', value: 10, color: 'a' },
      { label: 'Other', value: 5, color: 'b', isOther: true },
      { label: 'big', value: 100, color: 'c' },
    ]);
    expect(prepared.map((s) => s.label)).toEqual(['big', 'small', 'Other']);
    expect(prepared[0].percent).toBeCloseTo(86.96, 1);
  });
});
