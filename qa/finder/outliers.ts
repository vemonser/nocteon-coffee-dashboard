import type { CrawlResult } from './types.ts';

export interface Cluster {
  role: string;
  /** A human signature of the minority style. */
  signature: string;
  minority: number;
  total: number;
  share: number;
  pages: string[];
  /** The dominant style for this role. */
  dominant: string;
  dominantPages: string[];
  /** A stable key for the baseline. */
  key: string;
}

export interface OffScale {
  kind: 'spacing' | 'font-size' | 'color';
  role: string;
  value: string;
  pages: string[];
  count: number;
}

export interface OutlierResult {
  clusters: Cluster[];
  offScale: OffScale[];
  /** The ten most frequent minority clusters. */
  top: Cluster[];
}

type Fp = CrawlResult['fingerprints'][number];

function px(value: unknown): number {
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : NaN;
}

function signature(values: Fp['values']): string {
  const parts: string[] = [];
  const height = px(values['height']);
  if (Number.isFinite(height)) parts.push(`h ${height}px`);
  const pad = String(values['padding'] ?? '');
  if (pad && pad !== '0') parts.push(`pad ${pad}`);
  const font = String(values['fontSize'] ?? '');
  if (font) parts.push(`font ${font}`);
  const weight = String(values['fontWeight'] ?? '');
  if (weight) parts.push(`w ${weight}`);
  const radius = String(values['radius'] ?? '');
  if (radius) parts.push(`r ${radius}`);
  const bg = String(values['background'] ?? '');
  if (bg && bg !== 'rgba(0, 0, 0, 0)') parts.push(`bg ${bg}`);
  return parts.join(', ');
}

function unique<T>(list: T[]): T[] {
  return [...new Set(list)];
}

const SCALE = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32, 40, 48];

function parseRgb(value: string): { r: number; g: number; b: number; a: number } | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  if (p.length < 3) return null;
  return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
}

function hexToRgb(value: string): { r: number; g: number; b: number } | null {
  const hex = value.trim().replace('#', '');
  if (!/^[0-9a-f]{3,8}$/i.test(hex)) return null;
  const full =
    hex.length === 3 || hex.length === 4
      ? hex
          .slice(0, 3)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Cluster every role's style fingerprint and report the minorities. */
export function mineOutliers(result: CrawlResult): OutlierResult {
  const byRole = new Map<string, Fp[]>();
  for (const fp of result.fingerprints) {
    if (!byRole.has(fp.role)) byRole.set(fp.role, []);
    byRole.get(fp.role)!.push(fp);
  }

  const clusters: Cluster[] = [];
  for (const [role, items] of byRole) {
    if (items.length < 5) continue;
    const groups = new Map<string, Fp[]>();
    for (const item of items) {
      if (!groups.has(item.key)) groups.set(item.key, []);
      groups.get(item.key)!.push(item);
    }
    const ranked = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    const majority = ranked[0];
    const dominantSignature = signature(majority[1][0].values);
    const dominantPages = unique(majority[1].map((i) => i.page)).slice(0, 20);
    for (const [key, group] of ranked.slice(1)) {
      const share = group.length / items.length;
      if (share >= 0.15) continue;
      clusters.push({
        role,
        key: `${role}|${key.slice(0, 120)}`,
        signature: signature(group[0].values),
        minority: group.length,
        total: items.length,
        share: Math.round(share * 1000) / 10,
        pages: unique(group.map((i) => i.page)).slice(0, 20),
        dominant: dominantSignature,
        dominantPages,
      });
    }
  }
  clusters.sort((a, b) => b.minority - a.minority || b.share - a.share);

  const offScale: OffScale[] = [];
  const addOff = (kind: OffScale['kind'], role: string, value: string, page: string) => {
    const found = offScale.find((o) => o.kind === kind && o.role === role && o.value === value);
    if (found) {
      found.count += 1;
      if (!found.pages.includes(page)) found.pages.push(page);
      return;
    }
    offScale.push({ kind, role, value, pages: [page], count: 1 });
  };

  const tokenColors = new Set<string>();
  let parsedTokens = 0;
  for (const raw of result.tokens.colors) {
    const rgb = hexToRgb(raw) ?? parseRgb(raw);
    if (!rgb) continue;
    parsedTokens += 1;
    tokenColors.add(`${rgb.r},${rgb.g},${rgb.b}`);
  }

  for (const fp of result.fingerprints) {
    const pad = String(fp.values['padding'] ?? '');
    for (const value of pad.split(/\s+/)) {
      const n = px(value);
      if (Number.isFinite(n) && n > 0 && Math.abs(n % 4) > 0.6) {
        addOff('spacing', fp.role, `padding ${value}`, fp.page);
      }
    }
    for (const value of String(fp.values['gap'] ?? '').split(/\s+/)) {
      const n = px(value);
      if (Number.isFinite(n) && n > 0 && Math.abs(n % 4) > 0.6) {
        addOff('spacing', fp.role, `gap ${value}`, fp.page);
      }
    }
    const size = px(fp.values['fontSize']);
    if (Number.isFinite(size) && size > 0 && !SCALE.some((s) => Math.abs(s - size) < 0.6)) {
      addOff('font-size', fp.role, `${size}px`, fp.page);
    }
    if (parsedTokens >= 10) {
      for (const field of ['color', 'background'] as const) {
        const rgb = parseRgb(String(fp.values[field] ?? ''));
        if (!rgb || rgb.a < 0.99) continue;
        const key = `${Math.round(rgb.r)},${Math.round(rgb.g)},${Math.round(rgb.b)}`;
        if (!tokenColors.has(key)) addOff('color', fp.role, `${field} rgb(${key})`, fp.page);
      }
    }
  }

  offScale.sort((a, b) => b.count - a.count);
  return { clusters, offScale, top: clusters.slice(0, 10) };
}
