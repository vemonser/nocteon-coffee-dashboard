import { describe, expect, it } from 'vitest';
import {
  hasMoreAfter,
  metricsOf,
  nextScrollDelta,
  overflows,
  scrollRange,
  scrolledFromStart,
  type ScrollMetrics,
} from './scroll-affordance';

/**
 * FE-25a — the range strip's scroll affordance, as arithmetic.
 *
 * The two direction traps are the reason this is a unit and not a comment:
 * `scrollLeft` has no stable sign in RTL, and "more after" is therefore never
 * `scrollLeft < max`. Both are pinned in both directions.
 */

const ltr = (scrollLeft: number, clientWidth = 200, scrollWidth = 400): ScrollMetrics => ({
  scrollLeft,
  clientWidth,
  scrollWidth,
  rtl: false,
});

const rtl = (scrollLeft: number, clientWidth = 200, scrollWidth = 400): ScrollMetrics => ({
  scrollLeft,
  clientWidth,
  scrollWidth,
  rtl: true,
});

describe('scroll affordance', () => {
  it('knows when nothing needs scrolling (a wide screen: no affordance)', () => {
    expect(overflows(ltr(0, 600, 600))).toBe(false);
    expect(hasMoreAfter(ltr(0, 600, 600))).toBe(false);
  });

  it('tolerates sub-pixel layout (0.5px is not "more content")', () => {
    expect(overflows(ltr(0, 599.5, 600))).toBe(false);
    expect(hasMoreAfter(ltr(0, 599.5, 600))).toBe(false);
  });

  it('LTR: at the start there is more, at the end there is not', () => {
    expect(hasMoreAfter(ltr(0))).toBe(true);
    expect(hasMoreAfter(ltr(120))).toBe(true);
    expect(hasMoreAfter(ltr(200))).toBe(false);
  });

  it('LTR: a step moves forward and never overshoots the end', () => {
    expect(nextScrollDelta(ltr(0), 150)).toBe(150);
    expect(nextScrollDelta(ltr(150), 150)).toBe(50);
    expect(nextScrollDelta(ltr(200), 150)).toBe(0);
  });

  it('RTL: Chrome/Firefox report NEGATIVE offsets, so distance is absolute', () => {
    expect(scrolledFromStart(rtl(0))).toBe(0);
    expect(scrolledFromStart(rtl(-120))).toBe(120);
    expect(scrolledFromStart(rtl(-200))).toBe(200);
  });

  it('RTL: "more after" is measured from the START, not from the raw property', () => {
    expect(hasMoreAfter(rtl(0))).toBe(true);
    expect(hasMoreAfter(rtl(-200))).toBe(false);
  });

  it('RTL: the step is NEGATIVE, so the next screenful (to the left) is revealed', () => {
    expect(nextScrollDelta(rtl(0), 150)).toBe(-150);
    expect(nextScrollDelta(rtl(-150), 150)).toBe(-50);
    expect(nextScrollDelta(rtl(-200), 150)).toBe(0);
  });

  it('an offset past the end never reports a negative distance', () => {
    // Older WebKit reports the mirror image (max -> 0); a stale value must not
    // produce a negative distance or a backwards step.
    expect(scrolledFromStart(rtl(999))).toBe(200);
    expect(scrolledFromStart(ltr(-40))).toBe(0);
    expect(scrollRange(ltr(0, 500, 400))).toBe(0);
  });

  it('reads the live geometry off an element', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { value: 30, configurable: true });
    Object.defineProperty(element, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(element, 'scrollWidth', { value: 300, configurable: true });

    expect(metricsOf(element, false)).toEqual({
      scrollLeft: 30,
      clientWidth: 100,
      scrollWidth: 300,
      rtl: false,
    });
  });
});
