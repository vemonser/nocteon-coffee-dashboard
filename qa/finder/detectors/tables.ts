import type { Detector, Issue } from './types.ts';
import { css, insideNoise, qsa, rectOf, selectorOf, text, visible } from './util.ts';

const EMPTY = /^(|[-–—]+|n\/a|na|—)$/i;

const NUMERIC_HEADER =
  /(amount|total|price|stock|qty|quantity|count|orders|units|rate|%|revenue|sold|value|weight|kg|points|uses)/i;

const NUMBERISH = /^[\s\u00a0]*[-+]?[\d.,\s\u00a0]*\d[\d.,\s\u00a0]*%?[\s\u00a0]*$/;

function isEndAligned(el: Element): boolean {
  if (isEndAlignedSelf(el)) return true;
  return qsa(el, 'span,bdi,p,div').some(isEndAlignedSelf);
}

function isEndAlignedSelf(el: Element): boolean {
  const align = css(el).textAlign;
  const cls = el.getAttribute('class') ?? '';
  return align === 'end' || align === 'right' || /text-(end|right)/.test(cls);
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
  const key = `${id}|${selector}|${evidence.slice(0, 20)}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({ detector: 'tables', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

interface TableParts {
  table: Element;
  headers: Element[];
  rows: Element[][];
}

function tables(doc: Document): TableParts[] {
  return qsa(doc, 'table')
    .filter(visible)
    .map((table) => {
      const headers = qsa(table, 'thead th, thead td');
      const rows = qsa(table, 'tbody tr')
        .filter(visible)
        .map((row) => qsa(row, 'td'))
        .filter((cells) => cells.length > 0);
      return { table, headers, rows };
    })
    .filter((t) => t.headers.length > 0 && t.rows.length > 0);
}

/** A column whose body cells are all empty while the header is shown. */
export const detectEmptyColumns: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const { headers, rows } of tables(doc)) {
    headers.forEach((header, index) => {
      const title = text(header);
      if (!title) return;
      const cells = rows.map((r) => r[index]).filter(Boolean);
      if (!cells.length) return;
      const empty = (cell: Element) =>
        EMPTY.test(text(cell)) &&
        !cell.querySelector('img,svg,ng-icon,button,a,input,select,[aria-label],[data-testid],[style*="background"]') &&
        !cell.hasAttribute('aria-label');
      if (cells.every(empty)) {
        add(out, seen, header, 'tables.empty-column', 'high',
          'A column header is shown while every cell under it is empty.',
          `column "${title.trim()}" is empty in ${cells.length} row(s)`);
      }
    });
  }
  return out;
};

/** Header cell and body cells in the same column must share one x/width. */
export const detectMisalignedHeaders: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const { headers, rows } of tables(doc)) {
    const first = rows[0];
    if (!first || first.length !== headers.length) continue;
    headers.forEach((header, index) => {
      const cell = first[index];
      if (!cell || !visible(header) || !visible(cell)) return;
      const h = rectOf(header);
      const c = rectOf(cell);
      if (Math.abs(h.x - c.x) > 2 || Math.abs(h.w - c.w) > 8) {
        add(out, seen, header, 'tables.header-misaligned', 'medium',
          'A header cell does not line up with the column under it.',
          `"${text(header).slice(0, 30)}": header x=${Math.round(h.x)} w=${Math.round(h.w)}, cell x=${Math.round(c.x)} w=${Math.round(c.w)}`);
      }
    });
  }
  return out;
};

/** Numeric columns must be end-aligned so digits line up. */
export const detectNumericAlignment: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const { headers, rows } of tables(doc)) {
    headers.forEach((header, index) => {
      const title = text(header);
      const cells = rows.map((r) => r[index]).filter(Boolean);
      if (!cells.length) return;
      const numericCells = cells.filter((c) => NUMBERISH.test(text(c)));
      const numeric = NUMERIC_HEADER.test(title) || numericCells.length / cells.length >= 0.6;
      if (!numeric) return;
      const offenders = cells.filter((c) => !isEndAligned(c));
      if (offenders.length === cells.length) {
        add(out, seen, header, 'tables.numeric-not-end-aligned', 'medium',
          'A numeric column is not end-aligned.',
          `column "${title.trim() || '(no header)'}" has ${offenders.length} left-aligned cell(s)`);
      }
    });
  }
  return out;
};

/** Rows in one table must share one height. */
export const detectRowHeights: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const { table, rows } of tables(doc)) {
    const heights = rows
      .map((cells) => Math.round(rectOf(cells[0].parentElement ?? cells[0]).h))
      .filter((h) => h > 0);
    if (heights.length < 2) continue;
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    if (max - min > 2) {
      add(out, seen, table, 'tables.row-height', 'low',
        'Rows of one table have different heights.',
        `heights ${Array.from(new Set(heights)).sort((a, b) => a - b).join(', ')}px`);
    }
  }
  return out;
};

/** Truncated values must carry a tooltip with the full value. */
export const detectTruncationWithoutTooltip: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const candidates = qsa(
    doc,
    'td,th,[class*="truncate"],[class*="line-clamp"],[class*="ellipsis"],a,span,p',
  ).filter(
    (el) =>
      visible(el) &&
      !insideNoise(el) &&
      el.children.length === 0 &&
      !el.closest('button,[role="button"],.sr-only'),
  );
  for (const el of candidates) {
    if (el.tagName === 'TH' || el.closest('th')) continue;
    const cs = css(el);
    const truncated =
      cs.textOverflow === 'ellipsis' ||
      (el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX || cs.overflow));
    if (!truncated) continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const tooltip =
      el.getAttribute('title') || el.getAttribute('aria-label') || el.closest('[title]');
    if (tooltip) continue;
    add(out, seen, el, 'tables.truncated-no-tooltip', 'medium',
      'A value is truncated with no tooltip for the full text.',
      `"${text(el).slice(0, 40)}"`);
  }
  return out;
};
