/**
 * The arithmetic behind the range strip's scroll affordance.
 *
 * The range group on a phone is one row that scrolls sideways instead of
 * wrapping. A scrollbar is hidden there (a 6px scrollbar inside a 40px pill
 * reads as a defect), so without an affordance the reader sees four ranges
 * and has no way to learn that a fifth exists past the edge.
 *
 * The measurement is extracted from the component because it has two
 * direction-dependent traps that are cheap to get wrong and expensive to
 * debug in a browser:
 *
 *  1. `scrollLeft` has NO stable sign convention. In LTR it runs 0 → max. In
 *     RTL, Firefox and Chromium report 0 at the inline START and NEGATIVE
 *     values as the content moves, while older WebKit reports the mirror
 *     image (max → 0). Distance from the START is therefore computed as an
 *     absolute value clamped to the scrollable range — correct for both.
 *  2. "More after" is not `scrollLeft < max` in RTL, so it is derived from
 *     that same distance, never from the raw property.
 */
export interface ScrollMetrics {
  /** `element.scrollLeft` as the browser reports it. */
  scrollLeft: number;
  /** The visible width of the scroll container. */
  clientWidth: number;
  /** The full width of the content inside it. */
  scrollWidth: number;
  /** Is the page right-to-left? */
  rtl: boolean;
}

/** The largest possible distance from the inline start, in px. */
export function scrollRange(metrics: ScrollMetrics): number {
  return Math.max(0, metrics.scrollWidth - metrics.clientWidth);
}

/** Does the content need scrolling at all? (1px tolerates sub-pixel layout.) */
export function overflows(metrics: ScrollMetrics): boolean {
  return scrollRange(metrics) > 1;
}

/** How far the content has moved from the inline START, in px. */
export function scrolledFromStart(metrics: ScrollMetrics): number {
  const raw = metrics.rtl ? Math.abs(metrics.scrollLeft) : metrics.scrollLeft;
  return Math.min(Math.max(0, raw), scrollRange(metrics));
}

/** Is there content past the inline END that the reader cannot see? */
export function hasMoreAfter(metrics: ScrollMetrics): boolean {
  return overflows(metrics) && scrolledFromStart(metrics) < scrollRange(metrics) - 1;
}

/**
 * The `left` value to hand to `scrollBy` so the next screenful is revealed.
 *
 * In RTL the next screenful lives towards the left, which is a NEGATIVE
 * `left` offset in both of the engines that use negative RTL values. The
 * result never overshoots the end.
 */
export function nextScrollDelta(metrics: ScrollMetrics, page: number): number {
  const remaining = Math.max(0, scrollRange(metrics) - scrolledFromStart(metrics));
  const step = Math.max(0, Math.min(page, remaining));
  // `-0` is not `0` for a caller that compares with Object.is; a step of zero
  // is always reported as positive zero.
  if (step === 0) return 0;
  return metrics.rtl ? -step : step;
}

/** Read the live metrics of a scroll container. */
export function metricsOf(element: HTMLElement, rtl: boolean): ScrollMetrics {
  return {
    scrollLeft: element.scrollLeft,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    rtl,
  };
}
