import type { Detector, Issue } from './types.ts';
import { qsa, rectOf, selectorOf, text, visible } from './util.ts';

const CAP = /(\d[\d,]*)\s*\+/;
const NUM = /(\d[\d,]*)/;

function numberIn(value: string): { n: number; capped: boolean } | null {
  const cap = value.match(CAP);
  if (cap) return { n: Number(cap[1].replace(/,/g, '')), capped: true };
  const m = value.match(NUM);
  if (!m) return null;
  return { n: Number(m[1].replace(/,/g, '')), capped: false };
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
  out.push({ detector: 'counts', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

interface CountGroup {
  container: Element;
  items: Array<{ el: Element; label: string; n: number; capped: boolean }>;
}

function groups(doc: Document): CountGroup[] {
  const containers = qsa(
    doc,
    '[role="tablist"],[role="radiogroup"],[class*="chips"],[class*="chip-row"],[class*="filter-tabs"],[class*="segmented"]',
  ).filter(visible);
  const out: CountGroup[] = [];
  for (const container of containers) {
    const items = qsa(container, '[role="tab"],[role="radio"],button,a,[class*="chip"]')
      .filter(visible)
      .map((el) => {
        const label = text(el);
        const parsed = numberIn(label);
        return parsed ? { el, label, n: parsed.n, capped: parsed.capped } : null;
      })
      .filter((v): v is { el: Element; label: string; n: number; capped: boolean } => !!v);
    if (items.length >= 1) out.push({ container, items });
  }
  return out;
}

/** Chips/tabs with counts must add up to the "All" chip. */
export const detectChipSums: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const group of groups(doc)) {
    if (group.items.some((i) => i.capped)) continue;
    const all = group.items.find((i) => /\b(all|everything|total)\b|الكل/i.test(i.label));
    if (!all) continue;
    const others = group.items.filter((i) => i !== all);
    if (others.length < 2) continue;
    const sum = others.reduce((s, i) => s + i.n, 0);
    if (sum !== all.n) {
      add(out, seen, all.el, 'counts.chip-sum', 'high',
        'The status chips do not add up to the "All" count.',
        `${others.map((i) => `${i.label}=${i.n}`).join(' + ')} = ${sum}, All=${all.n}`);
    }
  }
  return out;
};

/** A capped badge ("9+") may only be used when the real count exceeds the cap. */
export const detectCappedBadges: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const group of groups(doc)) {
    for (const item of group.items) {
      if (!item.capped) continue;
      const active =
        item.el.getAttribute('aria-selected') === 'true' ||
        item.el.getAttribute('aria-checked') === 'true' ||
        item.el.getAttribute('data-state') === 'active';
      if (!active) continue;
      // The active tab's own panel tells the truth; the crawler clicks each tab
      // so every count is checked in the state where it is selected.
      const panel = qsa(doc, '[role="tabpanel"],[data-finder-panel],main table tbody').find(visible);
      if (!panel) continue;
      const real = qsa(panel, 'tbody tr, [data-finder-row]').filter(visible).length;
      if (real > 0 && real <= item.n) {
        add(out, seen, item.el, 'counts.capped-badge', 'high',
          'A count is capped with "+" although the real count does not exceed the cap.',
          `badge "${item.label}", ${real} row(s) shown`);
      }
    }
  }
  return out;
};

/** "1 - 10 of N" must be internally consistent. */
export const detectPaginationRange: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of qsa(doc, 'body *')) {
    if (!visible(el) || el.children.length > 0) continue;
    const value = text(el);
    const m = value.match(/^(\d[\d,]*)\s*[–-]\s*(\d[\d,]*)\s+(?:of|من)\s+(\d[\d,]*)$/i);
    if (!m) continue;
    const from = Number(m[1].replace(/,/g, ''));
    const to = Number(m[2].replace(/,/g, ''));
    const total = Number(m[3].replace(/,/g, ''));
    if (from < 1 || to < from || to > total || from > total) {
      add(out, seen, el, 'counts.pagination-range', 'high',
        'The pagination range is impossible for its total.', `"${value}"`);
    }
  }
  return out;
};

/** "N total" must match the pagination total or the visible rows. */
export const detectTotalCounts: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const rows = qsa(doc, 'tbody tr, [data-finder-row]').filter(visible).length;
  const rangeText = qsa(doc, 'body *')
    .filter((el) => visible(el) && el.children.length === 0)
    .map((el) => text(el))
    .find((t) => /^\d[\d,]*\s*[–-]\s*\d[\d,]*\s+(of|من)\s+\d/i.test(t));
  const total = rangeText
    ? Number((rangeText.match(/(?:of|من)\s+(\d[\d,]*)/i) ?? [])[1]?.replace(/,/g, ''))
    : null;
  for (const el of qsa(doc, 'body *')) {
    if (!visible(el) || el.children.length > 0) continue;
    const value = text(el);
    const m = value.match(/^(\d[\d,]*)\s+(?:total|إجمالي)$/i);
    if (!m) continue;
    const shown = Number(m[1].replace(/,/g, ''));
    if (total !== null && shown !== total) {
      add(out, seen, el, 'counts.total-mismatch', 'high',
        'A "total" count disagrees with the pagination total.', `"${value}" vs ${total}`);
    } else if (total === null && rows > 0 && shown < rows) {
      add(out, seen, el, 'counts.total-mismatch', 'medium',
        'A "total" count is smaller than the rows on screen.', `"${value}", ${rows} row(s)`);
    }
  }
  return out;
};
