import type { Detector, Issue } from './types.ts';
import {
  accessibleName,
  insideNoise,
  qsa,
  rectOf,
  selectorOf,
  text,
  visible,
} from './util.ts';

/** A translation key that leaked to the screen (`orders.statuses.DELIVERED`). */
const RAW_KEY = /\b[a-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*){2,}\b/;

/** A camelCase identifier shown as a label (`newProduct`, `productDetails`). */
const CAMEL_WORD = /\b[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*\b/;

/** Proper nouns whose internal capital is correct. */
const CAMEL_ALLOW = new Set([
  'macOS',
  'iOS',
  'iPhone',
  'iPad',
  'iMac',
  'macBook',
  'macBookPro',
  'iPhoneX',
  'eBay',
  'gitHub',
  'javaScript',
  'typeScript',
  'youTube',
  'freeShipping',
]);

const DEV_TEXT = /\b(needs backend|todo|fixme|placeholder text|lorem ipsum)\b/i;

const TITLE_SELECTOR =
  'h1,h2,h3,h4,[role="heading"],app-breadcrumb a,app-breadcrumb span,[data-testid*="title"],header a,header span';

function leaves(doc: Document): Element[] {
  return qsa(doc, 'body *').filter(
    (el) =>
      visible(el) &&
      !insideNoise(el) &&
      el.children.length === 0 &&
      text(el).length > 0 &&
      !el.closest('[data-finder-ignore]'),
  );
}

function push(
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
  out.push({ detector: 'i18n', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

/** 1 — raw keys, developer text, unresolved placeholders, undefined/null/NaN. */
export const detectI18n: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of leaves(doc)) {
    const value = text(el);

    const key = value.match(RAW_KEY);
    if (key) {
      push(out, seen, el, 'i18n.raw-key', 'high',
        'A translation key is rendered instead of its text.', `"${value.slice(0, 80)}"`);
    }

    if (DEV_TEXT.test(value)) {
      push(out, seen, el, 'i18n.developer-text', 'high',
        'Developer text is visible on the screen.', `"${value.slice(0, 80)}"`);
    }

    const placeholder = value.match(/\{\{?\s*[\w.]+\s*\}?\}/);
    if (placeholder) {
      push(out, seen, el, 'i18n.unresolved-placeholder', 'high',
        'An interpolation placeholder was not filled in.', `"${value.slice(0, 80)}"`);
    }

    if (/\b(undefined|null|NaN|\[object Object\])\b/.test(value)) {
      push(out, seen, el, 'i18n.invalid-value', 'high',
        'A missing value (undefined/null/NaN) is printed as text.', `"${value.slice(0, 80)}"`);
    }
  }

  // aria-label / title / placeholder are user-facing too.
  for (const el of qsa(doc, '[aria-label],[title],[placeholder],[alt]')) {
    if (!visible(el) || insideNoise(el)) continue;
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      if (RAW_KEY.test(value)) {
        push(out, seen, el, 'i18n.raw-key-attr', 'high',
          `A translation key is used as ${attr}.`, `${attr}="${value.slice(0, 60)}"`);
      }
      if (/\{\{?\s*[\w.]+\s*\}?\}/.test(value)) {
        push(out, seen, el, 'i18n.unresolved-placeholder-attr', 'high',
          `An unfilled placeholder is used as ${attr}.`, `${attr}="${value.slice(0, 60)}"`);
      }
    }
  }

  return out;
};

/** 1b — camelCase identifiers used as labels in titles and breadcrumbs. */
export const detectCamelLabels: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of qsa(doc, TITLE_SELECTOR)) {
    if (!visible(el)) continue;
    const value = text(el);
    for (const word of value.match(/\b[A-Za-z][A-Za-z0-9]*\b/g) ?? []) {
      if (!CAMEL_WORD.test(word) || CAMEL_ALLOW.has(word)) continue;
      push(out, seen, el, 'i18n.camel-label', 'medium',
        'A route/code identifier is shown where a translated label belongs.', `"${word}" in "${value.slice(0, 60)}"`);
    }
  }
  return out;
};

/** Exported for the crawl's aria snapshot check. */
export function accessibleNameOf(el: Element): string {
  return accessibleName(el);
}
