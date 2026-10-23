/**
 * Period-over-period delta.
 *
 * The rule set is fixed by the product decision:
 *
 *   - previous = 0, current > 0  -> "New"   (no baseline to compare against)
 *   - previous = 0, current = 0  -> "—"     (nothing happened, and no baseline)
 *   - current = previous         -> "No change" (neutral gray, no arrow)
 *   - current > previous         -> "+x%"  (positive)
 *   - current < previous         -> "-x%"  (negative)
 *
 * A zero change is NOT a positive change. The earlier implementation used
 * `pct >= 0` to decide "positive", so a 0.0% change rendered a green up
 * arrow — four KPIs on the dashboard showed "+0.0%" with an upward arrow
 * because the previous period happened to be identical to the current one.
 *
 * The result carries a `tone` instead of a raw boolean, because "New" is not
 * a warning and "no change" is not a direction:
 *
 *   'up'      positive change  -> success colour, up arrow
 *   'down'    negative change  -> destructive colour, down arrow
 *   'flat'    no change        -> muted colour, NO arrow
 *   'new'     no baseline      -> neutral colour, NO arrow
 *   'none'    not computable   -> muted, NO arrow
 */

export type DeltaTone = 'up' | 'down' | 'flat' | 'none';

export interface DeltaResult {
  /** Raw percentage change, rounded to 1 decimal. `null` when not computable. */
  percent: number | null;
  /** True when there is no previous value to compare against. */
  isNew: boolean;
  /** True when the value did not change. */
  isFlat: boolean;
  /** True when the change is a real increase. */
  isUp: boolean;
  /** True when the change is a real decrease. */
  isDown: boolean;
  /** Visual treatment. */
  tone: DeltaTone;
  /** For which metric this delta applies - used for color inversion */
  metric?: 'revenue' | 'orders' | 'customers' | 'coffee' | 'aov' | 'refundRate' | 'refunded' | 'repeat' | 'onlineUsers' | 'generic';
}

/** Below this magnitude a change is indistinguishable from no change. */
export const FLAT_THRESHOLD_PERCENT = 0.05;

export function computeDelta(
  current: number,
  previous: number | undefined | null,
  metric?: DeltaResult['metric'],
): DeltaResult {
  const none: DeltaResult = {
    percent: null,
    isNew: false,
    isFlat: true,
    isUp: false,
    isDown: false,
    tone: 'none',
    metric,
  };

  if (previous === undefined || previous === null) return none;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return none;

  // T1: If previous is 0 -> "No prior data" (none, not new)
  if (previous === 0) {
    return none;
  }

  const pct = ((current - previous) / previous) * 100;
  if (!Number.isFinite(pct)) return none;

  const rounded = Math.round(pct * 10) / 10;

  if (Math.abs(rounded) < FLAT_THRESHOLD_PERCENT) {
    // Equal values (and anything that rounds to zero) — neutral, no arrow.
    return { percent: 0, isNew: false, isFlat: true, isUp: false, isDown: false, tone: 'flat', metric };
  }

  // Determine if this metric should have inverted colors (refund/refunded are inverted)
  const isInverted = metric === 'refundRate' || metric === 'refunded';
  
  if (rounded > 0) {
    // Green for up, RED for up when inverted (refund/refunded)
    const tone = isInverted ? 'down' : 'up';
    return { percent: rounded, isNew: false, isFlat: false, isUp: !isInverted, isDown: isInverted, tone, metric };
  }
  // Red for down, GREEN for down when inverted (refund/refunded)
  const tone = isInverted ? 'up' : 'down';
  return { percent: rounded, isNew: false, isFlat: false, isUp: isInverted, isDown: !isInverted, tone, metric };
}

/**
 * What the card SHOWS for a delta.
 *
 * `new` — the "New" badge, which is only meaningful where newness IS the
 * news (the new-customers card).
 *
 * `percent` — the signed percentage.
 *
 * `flat` — "No change".
 *
 * `none` — nothing to show: either the delta is not computable, or there
 * was no previous period to compare against.
 *
 * Round 2, ticket 1.3: "New" on every card was wrong. When the previous
 * period is 0 and the current one is not, there is no percentage to show
 * — the store simply had no data to compare against — and four cards in a
 * row saying "New" says nothing. Those cards show an em dash and the
 * reason ("No data in the previous period") instead.
 */
export type DeltaDisplay = 'new' | 'percent' | 'flat' | 'none';

export function deltaDisplay(
  result: DeltaResult | null | undefined,
  newMeansNew = false,
): DeltaDisplay {
  if (!result) return 'none';
  switch (result.tone) {
    case 'flat':
      return 'flat';
    case 'up':
    case 'down':
      return 'percent';
    default:
      return 'none';
  }
}
