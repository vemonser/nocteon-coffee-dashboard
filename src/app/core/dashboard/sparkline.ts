/**
 * The sparkline geometry.
 *
 * A sparkline is a TREND, and a trend needs at least three points. The
 * dashboard's revenue series used to be drawn even when only ONE day of
 * it carried a value — the flat line with a single spike read as a
 * rendering artefact (a "stray line in the corner of the card") rather
 * than as data, and it pushed the card's value down out of line with the
 * other three.
 *
 * The rule, in one place:
 *
 *   - at least THREE points in the series, and
 *   - at least TWO of them above the series' minimum, so the line shows a
 *     TREND and is not a flat line with a single spike at the end (the
 *     revenue series is thirty days in which one day carried a value, and
 *     drawing that was the "stray line in the corner of the card").
 *
 * Pure and clock-free, so it can be unit-tested with 1, 2 and 7 points.
 */

export interface SparklineGeometry {
  /** The polyline's points, in the SVG's 100 x 24 box. */
  points: string;
  /** The filled area under the line. */
  area: string;
  /** The width of the box. */
  w: number;
  /** The height of the box. */
  h: number;
}

/** The width of the sparkline box, in SVG units. */
export const SPARKLINE_WIDTH = 100;

/** The height of the sparkline box, in SVG units. */
export const SPARKLINE_HEIGHT = 24;

/** The minimum number of points a sparkline needs. */
export const MIN_SPARKLINE_POINTS = 3;

/**
 * The sparkline for a series, or null when there is nothing to draw.
 */
export function sparklineGeometry(values: number[]): SparklineGeometry | null {
  const points = values.filter((v) => Number.isFinite(v));
  if (points.length < MIN_SPARKLINE_POINTS) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  // A single spike is not a trend: the line would be flat with one step.
  if (points.filter((v) => v > min).length < 2) return null;

  const span = max - min || 1;
  const w = SPARKLINE_WIDTH;
  const h = SPARKLINE_HEIGHT;

  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return { points: path, area: `0,${h} ${path} ${w},${h}`, w, h };
}
