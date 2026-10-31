import type { Detector, Issue } from './types.ts';
import {
  accessibleName,
  buttons,
  css,
  insideNoise,
  qsa,
  rectOf,
  selectorOf,
  text,
  visible,
} from './util.ts';

const SAME_ACTION_LABELS = new Set([
  'save', 'save changes', 'back', 'cancel', 'delete', 'remove', 'add', 'create',
  'edit', 'close', 'apply', 'submit', 'continue', 'next', 'previous', 'discard',
  'update', 'confirm',
]);

const GROUP_EXEMPT =
  '[role="tablist"],[role="group"],[role="radiogroup"],[role="menu"],[role="listbox"],[role="menubar"],[data-finder-ignore-adjacent],.button-group,[class*="button-group"],[class*="tabs"]';

function isPrimary(el: Element): boolean {
  const variant = el.getAttribute('data-variant') ?? el.getAttribute('data-slot') ?? '';
  if (/primary|default/.test(variant)) return true;
  return /(^|\s)bg-primary(\/|\s|$)|bg-primary\/\d/.test(el.getAttribute('class') ?? '');
}

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
  const key = `${id}|${selector}|${evidence.slice(0, 24)}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ detector: 'actions', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

/** Buttons that touch or nearly touch their neighbour, and glued labels. */
export const detectButtonSpacing: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const parents = new Set<Element>();
  for (const b of buttons(doc)) {
    if (b.parentElement) parents.add(b.parentElement);
  }

  for (const parent of parents) {
    if (parent.closest(GROUP_EXEMPT)) continue;
    const kids = buttons(doc).filter((b) => b.parentElement === parent);
    if (kids.length < 2) continue;
    const boxes = kids.map((el) => ({ el, box: rectOf(el) }));
    boxes.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
    for (let i = 1; i < boxes.length; i += 1) {
      const a = boxes[i - 1];
      const b = boxes[i];
      const sameRow = Math.abs(a.box.y - b.box.y) < Math.min(a.box.h, b.box.h) / 2;
      const gap = sameRow
        ? b.box.x - (a.box.x + a.box.w)
        : b.box.y - (a.box.y + a.box.h);
      if (gap >= 0 && gap < 4) {
        add(out, seen, b.el, 'actions.no-gap', 'medium',
          'Two adjacent buttons have no gap between them.',
          `gap ${Math.round(gap)}px between "${accessibleName(a.el)}" and "${accessibleName(b.el)}"`);
      }
    }

    // The same container whose raw text glues two child labels: "BackSave changes".
    // Only SAME-ROW controls: two stacked rows (menu items, list rows) always
    // concatenate in textContent and are not glued on screen.
    const raw = (parent.textContent ?? '').replace(/\s+/g, ' ');
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = 0; j < boxes.length; j += 1) {
        if (i === j) continue;
        const a = boxes[i];
        const b = boxes[j];
        const sameRow = Math.abs(a.box.y - b.box.y) < Math.min(a.box.h, b.box.h) / 2;
        if (!sameRow) continue;
        const first = accessibleName(a.el);
        const second = accessibleName(b.el);
        if (first.length > 1 && second.length > 1 && raw.includes(first + second)) {
          add(out, seen, parent, 'actions.glued-labels', 'medium',
            'Two button labels are concatenated into one word.',
            `"${first + second}"`);
        }
      }
    }
  }
  return out;
};

/** The same action offered twice in one view. */
export const detectDuplicateActions: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const scopes = qsa(doc, '[role="dialog"],[role="alertdialog"],.dialog-surface').filter(visible);
  if (!scopes.length) {
    const main = qsa(doc, 'main').find(visible);
    if (main) scopes.push(main);
  }
  for (const scope of scopes) {
    const counts = new Map<string, Element[]>();
    for (const b of buttons(doc)) {
      if (!scope.contains(b)) continue;
      if (b.closest('[role="menu"],[role="tablist"],nav')) continue;
      const label = accessibleName(b).toLowerCase().replace(/\s+/g, ' ').trim();
      if (!label) continue;
      if (!counts.has(label)) counts.set(label, []);
      counts.get(label)!.push(b);
    }
    for (const [label, els] of counts) {
      if (els.length < 2 || !SAME_ACTION_LABELS.has(label)) continue;
      add(out, seen, els[1], 'actions.duplicate-label', 'high',
        'The same action label appears twice in one view.',
        `"${label}" ×${els.length}`);
    }
  }
  return out;
};

/** More than one primary button in a dialog footer or a page footer. */
export const detectMultiplePrimary: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const footers = qsa(
    doc,
    '[role="dialog"] footer, .dialog-surface footer, [data-finder-footer], footer, [class*="dialog-footer"]',
  ).filter(visible);
  for (const footer of footers) {
    const primary = buttons(doc).filter(
      (b) => footer.contains(b) && isPrimary(b) && !b.closest('[role="menu"]'),
    );
    if (primary.length > 1) {
      add(out, seen, primary[1], 'actions.multiple-primary', 'high',
        'A footer offers more than one primary button.',
        `${primary.length} primary buttons: ${primary.map((b) => `"${accessibleName(b)}"`).join(', ')}`);
    }
  }
  return out;
};

/** The same actions inside a step AND in the footer of one dialog. */
export const detectStepAndFooterDuplicates: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const dialog of qsa(doc, '[role="dialog"],[role="alertdialog"]').filter(visible)) {
    const footer = qsa(dialog, 'footer,[class*="footer"]').find(visible);
    if (!footer) continue;
    const steps = qsa(
      dialog,
      '[role="tabpanel"],[data-finder-step],[class*="step"],[class*="actions"]',
    ).filter((el) => visible(el) && !footer.contains(el));
    const footerLabels = new Set(
      buttons(doc)
        .filter((b) => footer.contains(b))
        .map((b) => accessibleName(b).toLowerCase().trim())
        .filter(Boolean),
    );
    for (const step of steps) {
      const stepLabels = new Set(
        buttons(doc)
          .filter((b) => step.contains(b))
          .map((b) => accessibleName(b).toLowerCase().trim())
          .filter(Boolean),
      );
      const shared = [...stepLabels].filter(
        (l) => footerLabels.has(l) && SAME_ACTION_LABELS.has(l) && l !== 'cancel' && l !== 'back',
      );
      if (shared.length) {
        add(out, seen, step, 'actions.step-and-footer', 'medium',
          'The same action appears inside a step and in the dialog footer.',
          shared.map((s) => `"${s}"`).join(', '));
      }
    }
  }
  return out;
};

/** Unused imports guard: these helpers are used by sibling detectors. */
export const __actionHelpers = { css, insideNoise, text };
