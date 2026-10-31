import type { Detector, Issue } from './types.ts';
import { css, insideNoise, px, qsa, rectOf, selectorOf, text, visible } from './util.ts';

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
  out.push({ detector: 'layout', id, severity, selector, message, evidence, bbox: rectOf(el) });
}

function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const rgb = value.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }
  const hex = value.trim().match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    const h = hex[1];
    const full =
      h.length <= 4
        ? h
            .slice(0, 3)
            .split('')
            .map((c) => c + c)
            .join('')
        : h.slice(0, 6);
    const n = Number.parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const ok = value.match(/oklab\(([^)]+)\)/);
  if (ok) {
    const parts = ok[1].split(/[\s/]+/).filter(Boolean);
    const l = Number(parts[0]);
    const a = Number(parts[1]);
    const b = Number(parts[2]);
    const alpha = parts[3] !== undefined ? Number(parts[3]) : 1;
    if ([l, a, b].some((n) => !Number.isFinite(n))) return null;
    return oklabToRgb(l, a, b, Number.isFinite(alpha) ? alpha : 1);
  }
  const oklch = value.match(/oklch\(([^)]+)\)/);
  if (oklch) {
    const parts = oklch[1].split(/[\s/]+/).filter(Boolean);
    const l = Number(parts[0]);
    const c = Number(parts[1]);
    const hue = Number((parts[2] ?? '0').replace('deg', ''));
    const alpha = parts[3] !== undefined ? Number(parts[3]) : 1;
    if ([l, c, hue].some((n) => !Number.isFinite(n))) return null;
    const rad = (hue * Math.PI) / 180;
    return oklabToRgb(l, c * Math.cos(rad), c * Math.sin(rad), Number.isFinite(alpha) ? alpha : 1);
  }
  const srgb = value.match(/color\(\s*srgb\s+([^)]+)\)/);
  if (srgb) {
    const parts = srgb[1].split(/[\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3) return null;
    return { r: parts[0] * 255, g: parts[1] * 255, b: parts[2] * 255, a: parts[3] ?? 1 };
  }
  return null;
}

/** Oklab -> sRGB (the browser serializes color-mix() as oklab). */
function oklabToRgb(l: number, a: number, b: number, alpha: number) {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const ll = l_ ** 3;
  const mm = m_ ** 3;
  const ss = s_ ** 3;
  const linear = [
    4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss,
  ];
  const [r, g, b2] = linear.map((v) => {
    const c = Math.max(0, Math.min(1, v));
    return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
  });
  return { r, g, b: b2, a: alpha };
}

function blend(
  top: { r: number; g: number; b: number; a: number },
  bottom: { r: number; g: number; b: number; a: number },
) {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 255, g: 255, b: 255, a: 1 };
  return {
    r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
    g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
    b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
    a,
  };
}

function luminance(c: { r: number; g: number; b: number }): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function backgroundOf(el: Element): { r: number; g: number; b: number; a: number } {
  let node: Element | null = el;
  let color = { r: 255, g: 255, b: 255, a: 1 };
  const layers: Array<{ r: number; g: number; b: number; a: number }> = [];
  while (node && node.nodeType === 1) {
    const c = parseColor(css(node).backgroundColor);
    if (c && c.a > 0) {
      layers.unshift(c);
      if (c.a >= 1) break;
    }
    node = node.parentElement;
  }
  for (const layer of layers) color = blend(layer, color);
  return color;
}

function contrast(el: Element): number | null {
  const fg = parseColor(css(el).color);
  if (!fg) return null;
  const bg = backgroundOf(el);
  const l1 = luminance(fg.a < 1 ? blend(fg, bg) : fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function textLeaves(doc: Document): Element[] {
  return qsa(doc, 'body *').filter(
    (el) =>
      visible(el) &&
      !insideNoise(el) &&
      el.children.length === 0 &&
      text(el).length > 0 &&
      !el.closest('.sr-only,[data-finder-ignore]') &&
      css(el).visibility !== 'hidden',
  );
}

/** The page must not scroll sideways. */
export const detectHorizontalScroll: Detector = (doc) => {
  const out: Issue[] = [];
  const root = doc.documentElement;
  if (!root) return out;
  const overflow = root.scrollWidth - root.clientWidth;
  if (overflow > 1) {
    out.push({
      detector: 'layout',
      id: 'layout.horizontal-scroll',
      severity: 'high',
      selector: 'html',
      message: 'The page scrolls horizontally.',
      evidence: `${overflow}px past the viewport`,
      bbox: { x: 0, y: 0, w: root.scrollWidth, h: root.clientHeight },
    });
  }
  return out;
};

/** Text below 12px, and text whose contrast is under 4.5:1. */
export const detectTextSizeAndContrast: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of textLeaves(doc)) {
    const cs = css(el);
    const size = px(cs.fontSize);
    if (size > 0 && size < 12) {
      add(out, seen, el, 'layout.text-too-small', 'low',
        'Text is smaller than 12px.', `${size}px "${text(el).slice(0, 30)}"`);
    }
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const ratio = contrast(el);
    if (ratio !== null && ratio < (large ? 3 : 4.5)) {
      add(out, seen, el, 'layout.contrast', 'medium',
        'Text contrast is below the WCAG AA minimum.',
        `${ratio.toFixed(2)}:1 "${text(el).slice(0, 30)}"`);
    }
  }
  return out;
};

/** Text is clipped by its own box (not a designed ellipsis). */
export const detectClippedText: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of textLeaves(doc)) {
    const cs = css(el);
    if (!/hidden|clip/.test(cs.overflowX) && !/hidden|clip/.test(cs.overflow)) continue;
    if (cs.textOverflow === 'ellipsis') continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      add(out, seen, el, 'layout.clipped-text', 'medium',
        'Text is clipped inside its box.', `"${text(el).slice(0, 40)}"`);
    }
  }
  return out;
};

/** An image wider than 40% of the content column, outside a media context. */
export const detectOversizedMedia: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const main = qsa(doc, 'main,[role="main"]').find(visible) ?? doc.body;
  const contentWidth = rectOf(main).w;
  if (!contentWidth) return out;
  for (const el of qsa(doc, 'img,[data-finder-card],[class*="card"]')) {
    if (!visible(el)) continue;
    if (el.closest('[class*="hero"],[class*="cover"],[class*="gallery"],[class*="preview"],[class*="media"],[class*="chart"],[class*="logo"],[data-finder-ignore]')) continue;
    const box = rectOf(el);
    if (box.w > contentWidth * 0.4 && el.tagName === 'IMG') {
      add(out, seen, el, 'layout.oversized-media', 'low',
        'An image takes more than 40% of the content width.', `${Math.round(box.w)}px of ${Math.round(contentWidth)}px`);
    }
  }
  return out;
};

/** A grid's last row must not be left with an orphan cell. */
export const detectOrphanGridCells: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const el of qsa(doc, 'body *')) {
    if (!visible(el)) continue;
    const cs = css(el);
    if (cs.display !== 'grid' && cs.display !== 'inline-grid') continue;
    const columns = (cs.gridTemplateColumns ?? '').split(/\s+/).filter((v) => v && v !== 'none');
    if (columns.length < 2) continue;
    const children = Array.from(el.children).filter(visible);
    if (children.length <= columns.length) continue;
    const spanOf = (child: Element): number => {
      const column = css(child).gridColumn ?? '';
      const fromStyle = column.match(/span\s+(\d+)/);
      if (fromStyle) return Math.min(Number(fromStyle[1]), columns.length);
      const cls = child.getAttribute('class') ?? '';
      if (/(^|\s)([a-z-]+:)?col-span-full(\s|$)/.test(cls)) return columns.length;
      const fromClass = cls.match(/(?:^|\s)(?:[a-z-]+:)?col-span-(\d+)(?:\s|$)/);
      return fromClass ? Math.min(Number(fromClass[1]), columns.length) : 1;
    };
    const cells = children.reduce((sum, child) => sum + spanOf(child), 0);
    if (cells > columns.length && cells % columns.length !== 0) {
      add(out, seen, el, 'layout.orphan-grid-cell', 'medium',
        'The last row of a grid has an orphan cell.',
        `${children.length} children (${cells} grid cells) in ${columns.length} columns`);
    }
  }
  return out;
};

/** A hole of more than 120px between two siblings is dead space. */
export const detectLargeGaps: Detector = (doc) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  const parents = new Set<Element>();
  for (const el of qsa(doc, 'main *')) if (el.parentElement) parents.add(el.parentElement);
  for (const parent of parents) {
    if (parent.closest('table,ul,ol,[role="menu"],[class*="chart"],[data-finder-ignore]')) continue;
    const kids = Array.from(parent.children).filter(visible);
    if (kids.length < 2) continue;
    const boxes = kids.map((el) => rectOf(el)).sort((a, b) => a.y - b.y);
    for (let i = 1; i < boxes.length; i += 1) {
      const gap = boxes[i].y - (boxes[i - 1].y + boxes[i - 1].h);
      if (gap > 120) {
        add(out, seen, parent, 'layout.large-gap', 'low',
          'More than 120px of empty space sits between two blocks.', `${Math.round(gap)}px`);
      }
    }
  }
  return out;
};

/** Touch targets under 32px on a phone viewport. */
export const detectSmallTargets: Detector = (doc, ctx) => {
  const out: Issue[] = [];
  const seen = new Set<string>();
  if (ctx.viewport.w > 480) return out;
  for (const el of qsa(doc, 'button,a[role="button"],[role="tab"],[role="checkbox"],input,select')) {
    if (!visible(el) || insideNoise(el)) continue;
    const box = rectOf(el);
    if (box.w < 32 || box.h < 32) {
      add(out, seen, el, 'layout.small-touch-target', 'medium',
        'A touch target is smaller than 32px.',
        `${Math.round(box.w)}×${Math.round(box.h)} "${text(el).slice(0, 20) || el.getAttribute('aria-label') || el.tagName}"`);
    }
  }
  return out;
};
