import type { Detector, Issue } from './types.ts';
import {
  accessibleName,
  buttons,
  insideNoise,
  qsa,
  rectOf,
  selectorOf,
  text,
  visible,
} from './util.ts';

const DESTRUCTIVE = /(^|[\s-])(text-destructive|bg-destructive|border-destructive|destructive)(\/|\s|$)/;

const CREATE_TITLE = /\b(new|add|create|جديد|إضافة|إنشاء)\b/i;
const SAVE_CHANGES = /^(save changes|حفظ التغييرات)$/i;

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
  const key = `${id}|${selector}|${evidence.slice(0, 20)}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ detector: 'consistency', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

function isDestructive(el: Element): boolean {
  const cls = el.getAttribute('class') ?? '';
  return DESTRUCTIVE.test(cls) || el.getAttribute('data-variant') === 'destructive';
}

function dialogTitle(dialog: Element): string {
  const labelledBy = dialog.getAttribute('aria-labelledby');
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => text(dialog.ownerDocument.getElementById(id)))
      .join(' ');
  }
  const named = dialog.getAttribute('aria-label');
  if (named?.trim()) return named.trim();
  return text(qsa(dialog, 'h1,h2,h3,h4,[role="heading"]').find(visible));
}

/** A red delete/trash icon visible in every row (it belongs in a kebab menu). */
export const detectVisibleDestructiveIcons: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of qsa(doc, 'tbody tr button,tbody tr a,[data-finder-row] button,[data-finder-row] a,li button,li a')) {
    if (!visible(el) || insideNoise(el)) continue;
    if (el.closest('[role="menu"],[role="dialog"]')) continue;
    const label = accessibleName(el).toLowerCase();
    const looksDelete = /(delete|remove|trash|destroy|حذف|إزالة)/.test(label);
    if (isDestructive(el) && looksDelete) {
      add(out, seen, el, 'consistency.visible-destructive', 'high',
        'A destructive action is always visible in the row instead of inside the row menu.',
        `"${accessibleName(el)}"`);
    }
  }
  return out;
};

/** Icon-only buttons carry a name and a tooltip. */
export const detectUnnamedIconButtons: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of buttons(doc)) {
    if (insideNoise(el)) continue;
    const visibleText = text(el);
    const hasIcon = !!el.querySelector('svg,ng-icon,[class*="icon"]');
    if (el.closest('[aria-hidden="true"]')) continue;
    const aria = el.getAttribute('aria-label')?.trim();
    const labelledBy = el.getAttribute('aria-labelledby')?.trim();
    const role = el.getAttribute('role');
    if (role === 'combobox' || role === 'listbox' || role === 'slider') {
      if (!aria && !labelledBy && !visibleText) {
        add(out, seen, el, 'consistency.control-no-name', 'high',
          'A form control has no accessible name.', `role="${role}"`);
      }
      continue;
    }
    if (visibleText || !hasIcon) continue;
    if (!aria && !labelledBy) {
      add(out, seen, el, 'consistency.icon-button-no-name', 'high',
        'An icon-only button has no aria-label.', 'no accessible name');
    } else if (!el.getAttribute('title')?.trim() && !el.getAttribute('aria-describedby') && !el.hasAttribute('brnTooltip') && !el.hasAttribute('hlmTooltip') && !el.hasAttribute('data-tooltip')) {
      add(out, seen, el, 'consistency.icon-button-no-tooltip', 'low',
        'An icon-only button has no tooltip.', `aria-label="${aria ?? labelledBy}"`);
    }
  }
  return out;
};

/** Native alert/confirm/prompt, recorded by the init script. */
export const detectNativeDialogs: Detector = (_doc, ctx) => {
  const out: Issue[] = [];
  for (const [index, call] of (ctx.nativeDialogs ?? []).entries()) {
    out.push({
      detector: 'consistency',
      id: 'consistency.native-dialog',
      severity: 'high',
      selector: 'window',
      message: 'A native browser dialog is used instead of the app dialog service.',
      evidence: `${call.kind}("${call.message.slice(0, 60)}")`,
      bbox: { x: 0, y: 0, w: 0, h: 0 },
    });
    if (index > 4) break;
  }
  return out;
};

/** In a CREATE dialog the primary button names the action, not "Save changes". */
export const detectCreateSaveChanges: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const dialog of qsa(doc, '[role="dialog"],[role="alertdialog"]').filter(visible)) {
    const title = dialogTitle(dialog);
    if (!CREATE_TITLE.test(title)) continue;
    for (const b of buttons(doc)) {
      if (!dialog.contains(b)) continue;
      if (SAVE_CHANGES.test(text(b).trim())) {
        add(out, seen, b, 'consistency.create-save-changes', 'high',
          'A create dialog says "Save changes" instead of naming the action.',
          `dialog "${title.slice(0, 40)}"`);
      }
    }
  }
  return out;
};

/** Dialog footer order: destructive first, secondary, primary last. */
export const detectFooterOrder: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const dialog of qsa(doc, '[role="dialog"],[role="alertdialog"]').filter(visible)) {
    const footer = qsa(dialog, 'footer,[class*="footer"],[data-finder-footer]').find(visible);
    if (!footer) continue;
    const list = buttons(doc).filter((b) => footer.contains(b) && !b.closest('[role="menu"]'));
    if (list.length < 2) continue;
    const ranks = list.map((b) => {
      if (isDestructive(b)) return 0;
      const variant = (b.getAttribute('data-variant') ?? '').toLowerCase();
      if (variant === 'primary' || variant === 'default' || /bg-primary/.test(b.getAttribute('class') ?? '')) {
        return 2;
      }
      return 1;
    });
    const sorted = [...ranks].sort((a, b) => a - b);
    if (ranks.join('') !== sorted.join('')) {
      add(out, seen, footer, 'consistency.footer-order', 'medium',
        'The dialog footer order is not destructive, secondary, primary.',
        list.map((b) => `"${text(b)}"=${ranks[list.indexOf(b)]}`).join(', '));
    }
  }
  return out;
};
