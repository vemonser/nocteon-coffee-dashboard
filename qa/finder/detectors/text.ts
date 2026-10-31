import type { Detector, Issue } from './types.ts';
import { css, insideData, insideNoise, px, qsa, rectOf, selectorOf, text, visible } from './util.ts';

/** Words whose capital letters are legitimate (brands, products, acronyms). */
const PROPER_NOUNS = new Set([
  'Nocteon', 'Coffee', 'Egypt', 'Cairo', 'Alexandria', 'Arabic', 'English',
  'Stripe', 'Paymob', 'Google', 'Facebook', 'Instagram', 'Windows', 'Linux',
  'Android', 'iOS', 'macOS', 'Chrome', 'Safari', 'Firefox', 'Edge',
  'EGP', 'USD', 'EUR', 'GBP', 'VAT', 'SKU', 'CSV', 'PDF', 'API', 'URL', 'ID',
  'QR', 'SMS', 'SMTP', 'CSRF', 'JWT', 'OAuth', 'UTC', 'GMT', 'AM', 'PM',
  'Ethiopia', 'Kenya', 'Colombia', 'Brazil', 'Yirgacheffe', 'Nyeri', 'Huila',
  'Light', 'Medium', 'Dark', 'Roast', 'Filter', 'Espresso', 'V60', 'AeroPress',
]);

/** Words that are plural in form but singular in meaning. */
const SINGULAR_S_WORDS = new Set([
  'process', 'processes', 'status', 'address', 'analysis', 'series', 'species',
  'news', 'access', 'business', 'class', 'glass', 'pass', 'plus', 'campus',
  'census', 'focus', 'bonus', 'bus', 'gas', 'lens', 'response', 'license',
  'else', 'always', 'perhaps', 'whereas', 'across', 'less', 'unless',
]);

const LONG_MONTHS =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/;

const SINGULAR_NOUNS =
  /^(item|file|order|product|customer|review|message|session|page|row|result|day|user|role|cart|zone|post|variant|notification|broadcast|subscriber|store|category|setting|image|price|line|option|tag)$/i;

const UNIT_CASE = /\b(kb|mb|gb|tb|kib|mib|gib)(\/s)?\b/i;

function labelTargets(doc: Document): Element[] {
  return qsa(
    doc,
    'button,a,th,label,h1,h2,h3,h4,h5,[role="tab"],[role="menuitem"],[role="button"],[role="columnheader"]',
  ).filter((el) => visible(el) && !insideNoise(el) && !insideData(el));
}

function leaves(doc: Document): Element[] {
  return qsa(doc, 'body *').filter(
    (el) =>
      visible(el) &&
      !insideNoise(el) &&
      el.children.length === 0 &&
      (el.textContent ?? '').trim().length > 0 &&
      !el.closest('[data-finder-ignore]'),
  );
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
  const key = `${id}|${selector}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ detector: 'text', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

/** A Latin letter touching an Arabic letter inside one word. */
export const detectGluedScripts: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of leaves(doc)) {
    if (insideData(el)) continue;
    const value = text(el);
    const glued =
      value.match(/[\u0600-\u06FF][A-Za-z]/g) ?? value.match(/[A-Za-z][\u0600-\u06FF]/g);
    if (!glued) continue;
    add(out, seen, el, 'text.glued-scripts', 'high',
      'Latin and Arabic letters are glued into one word.',
      `"${value.slice(0, 60)}" (${glued.slice(0, 3).join(', ')})`);
  }
  return out;
};

/** Labels written in Title Case instead of sentence case. */
export const detectTitleCase: Detector = (doc, ctx) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  if (ctx.lang !== 'en') return out;
  for (const el of labelTargets(doc)) {
    // A label is a single string: a container holding other controls is a
    // layout, and its text is the concatenation of its children's labels.
    if (el.querySelector('button,a,input,select,textarea,[role="tab"],[role="menuitem"]')) continue;
    const value = text(el).replace(/[)\]}»”’.,:;!?]+$/, '').trim();
    if (value.length < 4 || value.length > 60 || /[@\d]/.test(value)) continue;
    if (value.split(/\s+/).length < 2) continue;
    const words = value.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
    const capitalized = words.filter((w) => /^[A-Z][a-z]/.test(w));
    const offenders = capitalized.filter((w) => !PROPER_NOUNS.has(w));
    if (offenders.length >= 2) {
      add(out, seen, el, 'text.title-case', 'medium',
        'A label is written in Title Case instead of sentence case.', `"${value}"`);
    }
  }
  return out;
};

/** Full month names in compact UI, dates with a space before the comma. */
export const detectDateText: Detector = (doc, ctx) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  if (ctx.lang !== 'en') return out;
  for (const el of leaves(doc)) {
    const value = text(el);
    const month = value.match(LONG_MONTHS)?.[1];
    if (month && /\d/.test(value) && month !== 'May') {
      add(out, seen, el, 'text.long-month', 'low',
        'A long month name is used in a compact date.', `"${value.slice(0, 60)}"`);
    }
    if (/\S\s+,/.test(value)) {
      add(out, seen, el, 'text.space-before-comma', 'low',
        'A space sits before the comma in a date.', `"${value.slice(0, 60)}"`);
    }
  }
  return out;
};

/** Double spaces, wrong unit case, plural after 1, singular after 0. */
export const detectWordHygiene: Detector = (doc, ctx) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  if (ctx.lang !== 'en') return out;

  for (const el of leaves(doc)) {
    const raw = el.textContent ?? '';
    if (/\S {2,}\S/.test(raw)) {
      add(out, seen, el, 'text.double-space', 'low',
        'Two spaces appear between words.', `"${text(el).slice(0, 60)}"`);
    }
  }

  for (const el of qsa(doc, 'body *')) {
    if (!visible(el) || insideNoise(el) || el.children.length > 0) continue;
    const value = text(el);

    const unit = value.match(UNIT_CASE);
    if (unit && unit[0] !== unit[0].toUpperCase()) {
      add(out, seen, el, 'text.unit-case', 'medium',
        'A data unit is written in the wrong case.', `"${unit[1]}" in "${value.slice(0, 60)}"`);
    }

    const one = value.match(/\b1\s+([A-Za-z]+)\b/);
    if (one) {
      const noun = one[1];
      if (/s$/i.test(noun) && !SINGULAR_S_WORDS.has(noun.toLowerCase())) {
        add(out, seen, el, 'text.plural-one', 'medium',
          'A plural noun follows the number 1.', `"${one[0]}"`);
      }
    }

    const zero = value.match(/\b0\s+([A-Za-z]+)\b/);
    if (zero && SINGULAR_NOUNS.test(zero[1])) {
      add(out, seen, el, 'text.singular-zero', 'low',
        'A singular noun follows the number 0.', `"${zero[0]}"`);
    }
  }
  return out;
};

/** The font-size floor used by the layout detector (kept here for reuse). */
export function fontSizeOf(el: Element): number {
  return px(css(el).fontSize);
}
