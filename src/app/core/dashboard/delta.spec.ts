import { describe, expect, it } from 'vitest';
import { computeDelta } from './delta';

describe('computeDelta', () => {
  it('previous = 0, current > 0 -> "New", no arrow, neutral tone', () => {
    const d = computeDelta(9, 0);
    expect(d.tone).toBe('new');
    expect(d.isNew).toBe(true);
    expect(d.isUp).toBe(false);
    expect(d.isDown).toBe(false);
    expect(d.percent).toBeNull();
  });

  it('both = 0 -> flat, no arrow, no percentage', () => {
    const d = computeDelta(0, 0);
    expect(d.tone).toBe('flat');
    expect(d.isNew).toBe(false);
    expect(d.percent).toBeNull();
  });

  it('equal values -> flat ("No change"), NOT a positive 0.0%', () => {
    const d = computeDelta(1176.25, 1176.25);
    expect(d.tone).toBe('flat');
    expect(d.isUp).toBe(false);
    expect(d.isDown).toBe(false);
    expect(d.percent).toBe(0);
  });

  it('increase -> up tone with a positive percentage', () => {
    const d = computeDelta(120, 100);
    expect(d.tone).toBe('up');
    expect(d.isUp).toBe(true);
    expect(d.percent).toBe(20);
  });

  it('decrease -> down tone with a negative percentage', () => {
    const d = computeDelta(80, 100);
    expect(d.tone).toBe('down');
    expect(d.isDown).toBe(true);
    expect(d.percent).toBe(-20);
  });

  it('previous larger than current -> down tone (never "up")', () => {
    const d = computeDelta(50, 200);
    expect(d.tone).toBe('down');
    expect(d.isUp).toBe(false);
    expect(d.percent).toBe(-75);
  });

  it('a change that rounds to zero is flat, not up', () => {
    const d = computeDelta(100.001, 100);
    expect(d.tone).toBe('flat');
    expect(d.percent).toBe(0);
  });

  it('previous undefined -> not computable', () => {
    const d = computeDelta(5, undefined);
    expect(d.tone).toBe('none');
    expect(d.percent).toBeNull();
  });

  it('non-finite input -> not computable', () => {
    expect(computeDelta(Number.NaN, 10).tone).toBe('none');
    expect(computeDelta(10, Number.POSITIVE_INFINITY).tone).toBe('none');
  });

  it('never reports "up" for a zero change — the regression that produced four green +0.0% arrows', () => {
    // The exact shape the dashboard hit: previous period identical to current.
    const d = computeDelta(1176.25, 1176.25);
    expect(d.isUp).toBe(false);
    expect(d.tone).not.toBe('up');
  });
});
