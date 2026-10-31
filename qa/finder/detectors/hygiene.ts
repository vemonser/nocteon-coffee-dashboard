import type { Detector, Issue } from './types.ts';
import { css, insideData, insideNoise, qsa, rectOf, selectorOf, text, visible } from './util.ts';

const SHORT_MONTH = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
const LONG_MONTH = '(January|February|March|April|May|June|July|August|September|October|November|December)';

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
  out.push({ detector: 'hygiene', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

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

interface DateHit {
  el: Element;
  raw: string;
  style: string;
  date: Date;
}

function datesIn(el: Element, value: string): DateHit[] {
  const hits: DateHit[] = [];
  let m: RegExpExecArray | null;

  const dmy = new RegExp(`\\b(\\d{1,2})\\s+${SHORT_MONTH}[a-z]*\\s+(\\d{4})\\b`, 'gi');
  while ((m = dmy.exec(value))) {
    const d = new Date(`${m[2]} ${m[1]}, ${m[3]} 12:00:00`);
    if (!Number.isNaN(d.getTime())) hits.push({ el, raw: m[0], style: 'dmy-short', date: d });
  }

  const mdy = new RegExp(`\\b${LONG_MONTH}\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi');
  while ((m = mdy.exec(value))) {
    const d = new Date(`${m[1]} ${m[2]}, ${m[3]} 12:00:00`);
    if (!Number.isNaN(d.getTime())) hits.push({ el, raw: m[0], style: 'mdy-long', date: d });
  }

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = iso.exec(value))) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
    if (!Number.isNaN(d.getTime())) hits.push({ el, raw: m[0], style: 'iso', date: d });
  }

  const slash = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  while ((m = slash.exec(value))) {
    const day = Number(m[1]) > 12 ? m[1] : m[2];
    const month = Number(m[1]) > 12 ? m[2] : m[1];
    const d = new Date(`${m[3]}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`);
    if (!Number.isNaN(d.getTime())) hits.push({ el, raw: m[0], style: 'slash', date: d });
  }

  return hits;
}

/** A seeded record must not carry a QA prefix on the screen. */
export const detectTestRecords: Detector = (doc, ctx) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const prefixes = (ctx.testPrefixes ?? []).map((p) => p.trim()).filter(Boolean);
  if (!prefixes.length) return out;
  for (const el of leaves(doc)) {
    if (insideData(el)) {
      // Data-marked names are exactly where a seeded record shows up.
    }
    const value = text(el);
    const hit = prefixes.find((p) => value.toLowerCase().startsWith(p.toLowerCase()));
    if (hit) {
      add(out, seen, el, 'hygiene.test-record', 'high',
        'A QA/test record is visible in the live UI.',
        `"${value.slice(0, 60)}" (prefix "${hit}")`);
    }
  }
  return out;
};

/** No record date may be in the future. */
export const detectFutureDates: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const now = Date.now() + 24 * 60 * 60 * 1000;
  for (const el of leaves(doc)) {
    for (const hit of datesIn(el, text(el))) {
      if (hit.date.getTime() > now) {
        add(out, seen, el, 'hygiene.future-date', 'high',
          'A date on the screen is in the future.', `"${hit.raw}"`);
      }
    }
  }
  return out;
};

/** One page should not mix date formats. */
export const detectMixedDateFormats: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const styles = new Map<string, DateHit>();
  let count = 0;
  for (const el of leaves(doc)) {
    for (const hit of datesIn(el, text(el))) {
      count += 1;
      if (!styles.has(hit.style)) styles.set(hit.style, hit);
    }
  }
  if (styles.size >= 2 && count >= 2) {
    const first = [...styles.values()][0];
    add(out, seen, first.el, 'hygiene.mixed-date-formats', 'low',
      'Two different date formats appear on one page.',
      [...styles.keys()].join(' + '));
  }
  return out;
};

/** Auto-scroll containers that hide the scrollbar are not an issue; unused import guard. */
export const __hygieneHelpers = { css };
