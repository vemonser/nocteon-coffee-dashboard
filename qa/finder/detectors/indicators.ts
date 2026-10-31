import type { Detector, Issue } from './types.ts';
import { css, qsa, rectOf, selectorOf, text, visible } from './util.ts';

const INDICATOR =
  '[class*="dot"],[class*="indicator"],[class*="badge"],[class*="pip"],[class*="status-dot"],[data-finder-indicator]';

function add(
  out: Issue[],
  seen: Set<string>,
  el: Element,
  id: string,
  severity: Issue['severity'],
  message: string,
  evidence: string,
): void {
  const selector = selectorOf(el);
  const key = `${id}|${selector}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ detector: 'indicators', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

/** A dot/badge must sit inside the box of the thing it marks. */
export const detectIndicatorOutside: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of qsa(doc, INDICATOR)) {
    if (!visible(el)) continue;
    const box = rectOf(el);
    // A badge is a chip when it has real text; only geometry-check the marks.
    if (box.w > 64 || box.h > 32) continue;
    const parent = el.parentElement;
    if (!parent || parent === doc.body) continue;
    const cs = css(el);
    if (cs.position === 'fixed') continue;
    const pbox = rectOf(parent);
    if (pbox.w <= 0 || pbox.h <= 0) continue;
    const outOfBox =
      box.x < pbox.x - 1 ||
      box.y < pbox.y - 1 ||
      box.x + box.w > pbox.x + pbox.w + 1 ||
      box.y + box.h > pbox.y + pbox.h + 1;
    if (outOfBox) {
      add(out, seen, el, 'indicators.outside-container', 'medium',
        'An indicator sits outside the box of the element it marks.',
        `indicator ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.w)}×${Math.round(box.h)} vs container ${Math.round(pbox.x)},${Math.round(pbox.y)} ${Math.round(pbox.w)}×${Math.round(pbox.h)}`);
    }
  }
  return out;
};
