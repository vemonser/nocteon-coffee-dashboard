import type { Box } from './types.ts';

/** The element's box: the fixture's data attribute first, then the real rect. */
export function rectOf(el: Element): Box {
  const raw = el.getAttribute('data-finder-box');
  if (raw) {
    const [x, y, w, h] = raw.split(',').map((n) => Number(n.trim()));
    if ([x, y, w, h].every((n) => Number.isFinite(n))) return { x, y, w, h } as Box;
  }
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** A test hook: jsdom's getComputedStyle is fragile, so fixtures use this. */
let cssResolver: ((el: Element) => CSSStyleDeclaration) | null = null;

export function setCssResolver(resolver: ((el: Element) => CSSStyleDeclaration) | null): void {
  cssResolver = resolver;
}

/** Is the element actually rendered? */
export function visible(el: Element): boolean {
  const box = rectOf(el);
  if (box.w <= 0 || box.h <= 0) {
    // jsdom has no layout engine: in the unit tests an element without a
    // `data-finder-box` is treated as laid out, so a fixture only opts into
    // geometry when the assertion is about geometry.
    if (!cssResolver || el.hasAttribute('data-finder-box')) return false;
  }
  const cs = css(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  if (cs.opacity && Number(cs.opacity) === 0) return false;
  return true;
}

/** Computed style, never null (a detached element returns an empty declaration). */
export function css(el: Element): CSSStyleDeclaration {
  if (cssResolver) return cssResolver(el);
  const win = el.ownerDocument.defaultView;
  return win ? win.getComputedStyle(el) : (el as unknown as { style: CSSStyleDeclaration }).style;
}

export function px(value: string | null | undefined): number {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
}

export function qsa(root: ParentNode, selector: string): Element[] {
  return Array.from(root.querySelectorAll(selector));
}

export function qs(root: ParentNode, selector: string): Element | null {
  return root.querySelector(selector);
}

/** Normalized text: collapsed whitespace, trimmed. */
export function text(el: Element | null): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The text of the element's DIRECT text nodes (not its children's). */
export function ownText(el: Element): string {
  let out = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 /* Node.TEXT_NODE */) out += node.textContent ?? '';
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** A stable, short selector for an element. */
export function selectorOf(el: Element): string {
  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;
  if (el.id) return `#${el.id}`;
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node.nodeType === 1 && depth < 4) {
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter(
        (c) => c.tagName === node!.tagName,
      );
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    if (node === el.ownerDocument.body) break;
    node = node.parentElement;
    depth += 1;
  }
  return parts.join(' > ');
}

/** True when the element (or an ancestor) is marked as data (not UI text). */
export function insideData(el: Element): boolean {
  return !!el.closest('[data-allow-latin]');
}

export function insideNoise(el: Element): boolean {
  return !!el.closest('script,style,noscript,svg,code,pre,[aria-hidden="true"]');
}

export function inViewport(box: Box, vp: { w: number; h: number }, pad = 1): boolean {
  return (
    box.x >= -pad &&
    box.y >= -pad &&
    box.x + box.w <= vp.w + pad &&
    box.y + box.h <= vp.h + pad
  );
}

export function overlaps(a: Box, b: Box, tolerance = 0): boolean {
  return (
    a.x + a.w > b.x + tolerance &&
    b.x + b.w > a.x + tolerance &&
    a.y + a.h > b.y + tolerance &&
    b.y + b.h > a.y + tolerance
  );
}

/** A repeated-space rule that ignores leading indentation of template text. */
export function hasDoubleSpace(value: string): boolean {
  return /\S {2,}\S/.test(value);
}

/** The visible buttons of a document, in DOM order. */
export function buttons(doc: Document): Element[] {
  return qsa(
    doc,
    'button, [role="button"], input[type="button"], input[type="submit"]',
  ).filter((el) => visible(el) && !insideNoise(el));
}

/** The accessible name of a control, best effort and DOM-only. */
export function accessibleName(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => text(el.ownerDocument.getElementById(id)))
      .filter(Boolean)
      .join(' ');
    if (label) return label;
  }
  const title = el.getAttribute('title');
  const t = text(el);
  if (t) return t;
  if (el instanceof el.ownerDocument.defaultView!.HTMLInputElement) {
    const input = el as HTMLInputElement;
    return (input.value || input.placeholder || title || '').trim();
  }
  return (title ?? '').trim();
}

/** Sum of a numeric attribute across the document (small helper). */
export function numberFrom(value: string): number | null {
  const m = value.replace(/[,\s\u00a0]/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}
