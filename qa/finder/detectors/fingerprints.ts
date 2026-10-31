import type { DetectorContext } from './types.ts';
import { css, insideNoise, px, qsa, rectOf, selectorOf, text, visible } from './util.ts';

export interface FingerprintValues {
  width: number;
  height: number;
  padding: string;
  borderWidth: string;
  borderColor: string;
  radius: string;
  fontSize: string;
  fontWeight: string;
  fontFamily: string;
  color: string;
  background: string;
  gap: string;
}

export interface Fingerprint {
  role: string;
  /** The clustering key: every value except width. */
  key: string;
  values: FingerprintValues;
  selector: string;
  text: string;
}

const KNOWN_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32, 40, 48];

function roleOf(el: Element): string | null {
  const override = el.getAttribute('data-finder-role');
  if (override) return override;

  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');

  if (role === 'dialog' || role === 'alertdialog') return 'dialog';
  if (el.closest('[role="dialog"],[role="alertdialog"]')) {
    if (el.closest('footer')) return 'dialog-footer';
    if (el.closest('header')) return 'dialog-header';
  }
  if (role === 'tab') return 'tab';
  if (role === 'switch' || tag === 'input' && (el as HTMLInputElement).type === 'checkbox') return 'toggle';
  if (tag === 'h1') return 'page-title';
  if (tag === 'th') return 'table-header-cell';
  if (tag === 'td') return 'table-cell';
  if (tag === 'table') return 'table';

  if (tag === 'input') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    const hint = `${(el as HTMLInputElement).placeholder} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('name') ?? ''}`;
    if (type === 'search' || /search|بحث/i.test(hint)) return 'search-input';
    if (type === 'checkbox' || type === 'radio') return 'toggle';
    return 'text-input';
  }
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  if (role === 'combobox') return 'select';

  if (tag === 'button' || role === 'button' || tag === 'a' && role === 'button') {
    const label = text(el);
    if (!label && el.querySelector('svg,ng-icon,[class*="icon"]')) return 'icon-button';
    const variant = (el.getAttribute('data-variant') ?? el.getAttribute('data-slot') ?? '').toLowerCase();
    const cls = el.getAttribute('class') ?? '';
    if (variant === 'destructive') return 'destructive-button';
    if (variant === 'primary' || variant === 'default' || /(^|\s)bg-primary/.test(cls)) return 'primary-button';
    if (variant === 'outline' || variant === 'secondary' || /border-/.test(cls)) return 'secondary-button';
    if (variant === 'ghost' || variant === 'link') return 'ghost-button';
    return 'button';
  }

  const cls = el.getAttribute('class') ?? '';
  if (tag === 'img' && /avatar/.test(cls)) return 'avatar';
  if (/(^|[\s-])(badge|chip|pill|status-badge)([\s-]|$)/.test(cls)) return 'badge';
  if (tag === 'hlm-card' || el.getAttribute('data-slot') === 'card' || /(^|[\s-])card([\s-]|$)/.test(cls)) {
    return 'card';
  }
  return null;
}

function valuesOf(el: Element): FingerprintValues {
  const cs = css(el);
  const box = rectOf(el);
  const pad = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`;
  return {
    width: Math.round(box.w),
    height: Math.round(box.h),
    padding: pad === '0px 0px 0px 0px' ? '0' : pad,
    borderWidth: cs.borderTopWidth ?? '0px',
    borderColor: cs.borderTopColor ?? 'rgba(0, 0, 0, 0)',
    radius: cs.borderTopLeftRadius ?? '0px',
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    fontFamily: (cs.fontFamily ?? '').split(',')[0].replace(/["']/g, '').trim(),
    color: cs.color,
    background: cs.backgroundColor,
    gap: `${cs.rowGap === 'normal' ? '0px' : cs.rowGap} ${cs.columnGap === 'normal' ? '0px' : cs.columnGap}`,
  };
}

/** Every role on the page, with the styles that define its look. */
export function collectFingerprints(doc: Document, _ctx: DetectorContext): Fingerprint[] {
  const out: Fingerprint[] = [];
  const seen = new Set<string>();
  for (const el of qsa(doc, 'body *')) {
    if (!visible(el) || insideNoise(el)) continue;
    const role = roleOf(el);
    if (!role) continue;
    if (role === 'card' && el.closest('[data-finder-role="card"]')) continue;
    const selector = selectorOf(el);
    if (seen.has(`${role}|${selector}`)) continue;
    seen.add(`${role}|${selector}`);
    const values = valuesOf(el);
    const { width: _width, ...rest } = values;
    out.push({
      role,
      key: JSON.stringify(rest),
      values,
      selector,
      text: text(el).slice(0, 60),
    });
  }
  return out;
}

/** The colours the design system actually exposes as tokens. */
export function collectTokens(doc: Document): { colors: string[]; fontSizes: number[] } {
  const win = doc.defaultView;
  if (!win) return { colors: [], fontSizes: [] };
  const colors: string[] = [];
  const fontSizes: number[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof win.CSSStyleRule)) continue;
      const style = rule.style;
      for (const name of Array.from(style)) {
        if (!name.startsWith('--')) continue;
        const value = style.getPropertyValue(name).trim();
        if (/^(#|rgb|hsl|oklch|color\()/.test(value)) colors.push(value);
      }
    }
  }
  // The live values too (a token may be declared on :root inline).
  const rootStyle = win.getComputedStyle(doc.documentElement);
  for (const name of Array.from(rootStyle)) {
    if (!name.startsWith('--')) continue;
    const value = rootStyle.getPropertyValue(name).trim();
    if (/^(#|rgb|hsl)/.test(value)) colors.push(value);
  }
  return { colors, fontSizes };
}

/** Is a font size on the design type scale? */
export function onTypeScale(sizePx: number): boolean {
  return KNOWN_FONT_SIZES.some((known) => Math.abs(known - sizePx) < 0.6);
}

/** Is a spacing value on the 4px grid? */
export function onSpacingScale(value: string): boolean {
  const n = px(value);
  if (!Number.isFinite(n)) return true;
  return Math.abs(n % 4) < 0.6;
}
