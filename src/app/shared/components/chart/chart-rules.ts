/**
 * The chart system's rules, in one place.
 *
 * Everything a chart on the dashboard may do is decided here, so two charts
 * can never disagree about when a donut is allowed, which colour a slice
 * gets, or where the legend sits.
 */

/** A slice of a breakdown. */
export interface ChartSlice {
  /** The label shown in the legend and on the axis. */
  label: string;
  /** The quantity (revenue, count, weight). */
  value: number;
  /** The colour token, e.g. `var(--chart-2)`. */
  color: string;
  /** Set when the label means "everything else". */
  isOther?: boolean;
}

/** How a breakdown is drawn. */
export type ChartKind = 'donut' | 'bars' | 'stat';

/**
 * The chart-type rule.
 *
 * A donut only works with a few slices: above five the slices are too thin
 * to read or to label, and below the minimum SIZE it is not a chart at all.
 * TWO slices are a donut: a part-to-whole question with two answers ("Online
 * vs cash on delivery") is still a part-to-whole question, and two bars made
 * the payment-method and roast-level breakdowns read as a different kind of
 * chart from the origin breakdown beside them.
 *
 *  - 0 or 1 slice  -> a STAT (a number, not a chart)
 *  - 2..5 slices   -> DONUT, if the chart is at least MIN_DONUT_PX wide
 *  - 6+ slices     -> BARS
 */
export const MIN_DONUT_SLICES = 2;
export const MAX_DONUT_SLICES = 5;
export const MIN_DONUT_PX = 160;

export function chartKindFor(sliceCount: number, sizePx: number): ChartKind {
  if (sliceCount <= 1) return 'stat';
  if (sliceCount < MIN_DONUT_SLICES) return 'bars';
  if (sliceCount > MAX_DONUT_SLICES) return 'bars';
  if (sizePx < MIN_DONUT_PX) return 'bars';
  return 'donut';
}

/**
 * The categorical palette, in order.
 *
 * The first colour is also the colour of a SINGLE-SERIES chart (revenue,
 * devices, payment methods): one series, one colour — a rainbow for one
 * number is noise.
 */
export const CATEGORICAL = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

/** A single series uses the first colour. */
export const SINGLE_SERIES = 'var(--chart-1)';

/** The neutral token for an "Other" bucket. */
export const OTHER = 'var(--chart-other)';

/**
 * The sequential ramp for an ORDERED dimension (roast level: light -> dark).
 *
 * An ordered dimension must not use the categorical set: the reader has to
 * see the order, and the ramp carries it.
 */
export const SEQUENTIAL = [
  'var(--roast-1)',
  'var(--roast-2)',
  'var(--roast-3)',
  'var(--roast-4)',
];

/**
 * The semantic colours for an order status.
 *
 * Delivered = a green, Processing = a blue, Shipped = a violet, Pending =
 * an amber, Cancelled/Failed = a red, Refunded = a neutral. A status is
 * not a category, so it does not use the categorical palette — and it does
 * not use the TEXT tokens either: the text tokens are the light-on-dark
 * colours, and the old dark palette put a neon green (#4ade80) and a
 * bright cyan (#22d3ee) on the card as chart swatches.
 *
 * Every one of these is at least 15 OKLab dE away from every categorical
 * swatch, so a status slice can be told from an origin slice that is
 * drawn right next to it (measured:
 * evidence/dashboard-r2/color-math.json).
 */
export const STATUS_COLORS = {
  DELIVERED: 'var(--status-delivered)',
  // CONFIRMED has its OWN swatch. It used to share the delivered green,
  // which means two slices of the SAME ring can be the same colour.
  CONFIRMED: 'var(--status-confirmed)',
  PROCESSING: 'var(--status-processing)',
  SHIPPED: 'var(--status-shipped)',
  PENDING: 'var(--status-pending)',
  CANCELLED: 'var(--status-cancelled)',
  FAILED: 'var(--status-cancelled)',
  REFUNDED: 'var(--status-refunded)',
} as const satisfies Record<string, string>;

/** The lookup, typed for an arbitrary key. */
const STATUS_COLOR_MAP: Record<string, string> = STATUS_COLORS;

/** The colour for a status, falling back to the neutral token. */
export function statusColor(status: string): string {
  return STATUS_COLOR_MAP[status?.toUpperCase()] ?? OTHER;
}

/**
 * The colours for a set of slices.
 *
 * `mode` decides the palette: `categorical` for unordered breakdowns,
 * `sequential` for an ordered dimension, `single` for one series.
 */
export function sliceColors(
  count: number,
  mode: 'categorical' | 'sequential' | 'single' = 'categorical',
): string[] {
  if (mode === 'single') return [SINGLE_SERIES];
  const palette = mode === 'sequential' ? SEQUENTIAL : CATEGORICAL;
  return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
}

/**
 * The share of the total a slice represents, as a percentage.
 *
 * Returns 0 for an empty total rather than NaN — a zero-width slice is
 * honest, a NaN label is not.
 */
export function percentOf(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

/**
 * The share of the total, in the chart's own series order.
 *
 * The "Other" bucket is always last, whatever order the data came in.
 */
export function withPercents(slices: ChartSlice[]): Array<ChartSlice & { percent: number }> {
  const total = slices.reduce((sum, s) => sum + (s.value || 0), 0);
  const sorted = [...slices].sort((a, b) => {
    if (a.isOther !== b.isOther) return a.isOther ? 1 : -1;
    return (b.value || 0) - (a.value || 0);
  });
  return sorted.map((s) => ({ ...s, percent: percentOf(s.value || 0, total) }));
}
