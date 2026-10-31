import type { Detector, Issue } from './types.ts';
import {
  inViewport,
  overlaps,
  qsa,
  rectOf,
  selectorOf,
  text,
  visible,
} from './util.ts';

const OPEN_OVERLAY =
  '[role="menu"],[role="listbox"],[role="dialog"],[role="alertdialog"],[role="tooltip"],[data-state="open"][role],[data-radix-popper-content-wrapper],[data-slot="dropdown-menu-content"],[data-slot="popover-content"]';

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
  const key = `${id}|${selector}|${evidence.slice(0, 16)}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ detector: 'overlays', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

function accessibleName(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => text(el.ownerDocument.getElementById(id)))
      .join(' ')
      .trim();
  }
  const heading = qsa(el, 'h1,h2,h3,h4,[role="heading"]').find(visible);
  return text(heading) || text(el).slice(0, 60);
}

/** Open overlays: inside the viewport, not covering their trigger, named. */
export const detectOverlays: Detector = (doc, ctx) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of qsa(doc, OPEN_OVERLAY)) {
    if (!visible(el)) continue;
    const box = rectOf(el);
    if (box.w < 8 || box.h < 8) continue;

    if (!inViewport(box, ctx.viewport, 2)) {
      add(out, seen, el, 'overlays.outside-viewport', 'high',
        'An open overlay leaves the viewport.',
        `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.w)}×${Math.round(box.h)} in ${ctx.viewport.w}×${ctx.viewport.h}`);
    }

    if (ctx.trigger && overlaps(box, ctx.trigger.box, 2)) {
      add(out, seen, el, 'overlays.overlaps-trigger', 'medium',
        'An open overlay covers the control that opened it.',
        `overlay "${text(el).slice(0, 30)}" overlaps ${ctx.trigger.selector}`);
    }

    if (el.getAttribute('role') === 'dialog' || el.getAttribute('role') === 'alertdialog') {
      if (!accessibleName(el)) {
        add(out, seen, el, 'overlays.dialog-no-name', 'high',
          'A dialog has no accessible name.', 'no aria-label, aria-labelledby or heading');
      }
    }
  }
  return out;
};
