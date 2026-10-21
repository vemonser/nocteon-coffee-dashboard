import { describe, expect, it } from 'vitest';
import { MIN_SPARKLINE_POINTS, sparklineGeometry } from './sparkline';

/**
 * The sparkline rule (Round 2, ticket 4.2).
 *
 * A sparkline is a trend, and a trend needs points. The dashboard's
 * revenue card used to draw one for a series of thirty days in which only
 * ONE day carried a value: a flat line with a spike, which read as a
 * rendering artefact.
 */
describe('sparkline geometry', () => {
  it('draws nothing for a single point', () => {
    expect(sparklineGeometry([1176.25])).toBeNull();
  });

  it('draws nothing for two points', () => {
    expect(sparklineGeometry([0, 1176.25])).toBeNull();
    expect(sparklineGeometry([10, 20])).toBeNull();
  });

  it('draws a sparkline for seven points', () => {
    const geometry = sparklineGeometry([10, 40, 25, 60, 30, 80, 45]);
    expect(geometry).not.toBeNull();
    expect(geometry?.points.split(' ')).toHaveLength(7);
    expect(geometry?.area).toContain('0,24');
  });

  it('draws nothing when only one point carries a value', () => {
    // The real dashboard series: thirty days, one day with revenue.
    const series = Array.from({ length: 29 }, () => 0).concat([1176.25]);
    expect(sparklineGeometry(series)).toBeNull();
  });

  it('draws nothing when the series is empty', () => {
    expect(sparklineGeometry([])).toBeNull();
  });

  it('ignores the values that are not numbers', () => {
    expect(sparklineGeometry([Number.NaN, 10, 20, 30])).not.toBeNull();
    expect(sparklineGeometry([Number.NaN, Number.NaN, Number.NaN])).toBeNull();
  });

  it('draws nothing for a flat series — there is no trend in it', () => {
    expect(sparklineGeometry([5, 5, 5, 5])).toBeNull();
    expect(sparklineGeometry([0, 0, 0])).toBeNull();
  });

  it('puts the highest value at the top and the lowest at the bottom', () => {
    const geometry = sparklineGeometry([0, 10, 20]);
    const ys = geometry?.points.split(' ').map((p) => Number(p.split(',')[1]));
    expect(ys?.[0]).toBe(24);
    expect(ys?.[2]).toBe(0);
  });

  it('needs at least three points', () => {
    expect(MIN_SPARKLINE_POINTS).toBe(3);
  });
});
