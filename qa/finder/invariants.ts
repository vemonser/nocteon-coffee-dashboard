import type { Page } from 'playwright';
import type { Finding } from './types.ts';

export type UiKind =
  | 'number'
  | 'percent'
  | 'trailing-number'
  | 'paginator-total'
  | 'kpi'
  | 'attention'
  | 'chip';

export interface UiReader {
  selector: string;
  kind: UiKind;
  /** The label used by kpi / attention / chip readers. */
  label?: string;
}

export interface Oracle {
  name: string;
  route: string;
  severity: 'high' | 'medium';
  ui: UiReader;
  apiCall: string;
  /** A pure function of the API `data`. */
  transform: (data: any) => number | string | null;
}

const shippedReviews = (data: any): any[] => data?.content ?? [];

/**
 * The declarative oracles. Adding one is three lines: a route, a UI reader and
 * a transform of the API payload. The runner does the visit, the auth, the
 * comparison and the report.
 */
export const ORACLES: Oracle[] = [
  {
    name: 'sidebar-orders-badge',
    route: '/dashboard',
    severity: 'high',
    ui: { selector: 'a[href="/dashboard/orders"]', kind: 'trailing-number' },
    apiCall: '/api/dashboard/nav-counts',
    transform: (data) => data?.openOrders ?? null,
  },
  {
    name: 'sidebar-reviews-badge',
    route: '/dashboard',
    severity: 'high',
    ui: { selector: 'a[href="/dashboard/reviews"]', kind: 'trailing-number' },
    apiCall: '/api/dashboard/nav-counts',
    transform: (data) => data?.pendingReviews ?? null,
  },
  {
    name: 'sidebar-unread-messages-badge',
    route: '/dashboard',
    severity: 'high',
    ui: { selector: 'a[href="/dashboard/contact-messages"]', kind: 'trailing-number' },
    apiCall: '/api/dashboard/nav-counts',
    transform: (data) => data?.contactUnread ?? null,
  },
  {
    name: 'notification-bell',
    route: '/dashboard',
    severity: 'high',
    ui: { selector: '[data-testid="notifications-bell"]', kind: 'trailing-number' },
    apiCall: '/api/dashboard/notifications/unread-count',
    transform: (data) => (typeof data === 'number' ? data : null),
  },
  {
    name: 'dashboard-paid-orders-kpi',
    route: '/dashboard',
    severity: 'high',
    ui: { selector: 'app-kpi-card', kind: 'kpi', label: 'Paid orders' },
    apiCall: '/api/dashboard/stats/overview?days=30',
    transform: (data) => data?.totalOrders ?? null,
  },
  {
    name: 'dashboard-open-orders-attention',
    route: '/dashboard',
    severity: 'high',
    ui: { selector: 'app-needs-attention-panel', kind: 'attention', label: 'Open orders' },
    apiCall: '/api/dashboard/nav-counts',
    transform: (data) => data?.openOrders ?? null,
  },
  {
    name: 'products-list-total',
    route: '/dashboard/products',
    severity: 'medium',
    ui: { selector: 'app-pager', kind: 'paginator-total' },
    apiCall: '/api/dashboard/products?page=0&size=1',
    transform: (data) => data?.totalElements ?? null,
  },
  {
    name: 'orders-list-total',
    route: '/dashboard/orders',
    severity: 'medium',
    ui: { selector: 'app-pager', kind: 'paginator-total' },
    apiCall: '/api/dashboard/orders?page=0&size=1',
    transform: (data) => data?.totalElements ?? null,
  },
  {
    name: 'reviews-verified-percentage',
    route: '/dashboard/reviews',
    severity: 'high',
    ui: { selector: '[data-testid="reviews-stat-verified"]', kind: 'percent' },
    apiCall: '/api/dashboard/reviews?page=0&size=100',
    transform: (data) => {
      const all = shippedReviews(data);
      if (!all.length) return null;
      const verified = all.filter((r) => r?.verified === true || r?.Verified === true).length;
      return Math.round((verified / all.length) * 100);
    },
  },
  {
    name: 'reviews-pending-chip',
    route: '/dashboard/reviews',
    severity: 'high',
    ui: { selector: '[role="tablist"]', kind: 'chip', label: 'Pending' },
    apiCall: '/api/dashboard/reviews?page=0&size=100',
    transform: (data) => shippedReviews(data).filter((r) => String(r?.status).toUpperCase() === 'PENDING').length,
  },
  {
    name: 'order-total-from-lines-and-shipping',
    route: '/dashboard/orders/:firstOrderId',
    severity: 'high',
    ui: { selector: '[data-testid="order-total"]', kind: 'number' },
    apiCall: '/api/dashboard/orders/:firstOrderId',
    transform: (data) => {
      const lines = (data?.items ?? []).reduce((sum: number, item: any) => sum + Number(item?.totalPrice ?? 0), 0);
      const shipping = Number(data?.shippingCost ?? 0);
      const discount = Number(data?.discountAmount ?? 0);
      if (!lines && !shipping) return null;
      return Math.round((lines + shipping - discount) * 100) / 100;
    },
  },
];

function readUi(page: Page, ui: UiReader): Promise<number | null> {
  return page.evaluate(({ selector, kind, label }) => {
    const number = (value: string): number | null => {
      const m = value.replace(/[\u2066\u2069\u00a0]/g, ' ').match(/-?\d+(?:[.,]\d+)*/);
      if (!m) return null;
      // "2,650.00" is thousands+decimal; "2.650,00" is the other convention.
      const lastComma = m[0].lastIndexOf(',');
      const lastDot = m[0].lastIndexOf('.');
      let normalized = m[0];
      if (lastComma > lastDot) normalized = m[0].replace(/\./g, '').replace(',', '.');
      else normalized = m[0].replace(/,/g, '');
      const n = Number(normalized);
      return Number.isFinite(n) ? n : null;
    };
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

    if (kind === 'paginator-total') {
      const el = Array.from(document.querySelectorAll(selector))[0];
      const m = text(el).match(/(?:of|من)\s+([\d.,\s]+)/i);
      return m ? number(m[1]) : null;
    }
    if (kind === 'kpi') {
      const cards = Array.from(document.querySelectorAll(selector));
      const card = cards.find((c) => text(c.querySelector('[data-testid="kpi-label"]')).includes(label ?? ''));
      return number(text(card?.querySelector('[data-testid="stat-value"]') ?? null));
    }
    if (kind === 'attention') {
      const panel = document.querySelector(selector);
      const items = Array.from(panel?.querySelectorAll('a,section,div') ?? []);
      const match = items.find((el) => text(el).includes(label ?? '') && /\d/.test(text(el)));
      if (!match) return null;
      const after = text(match).split(label ?? '')[1] ?? '';
      return number(after);
    }
    if (kind === 'chip') {
      const chips = Array.from(document.querySelectorAll(`${selector} [role="tab"], ${selector} button`));
      const chip = chips.find((el) => text(el).startsWith(label ?? ''));
      return number(text(chip));
    }
    if (kind === 'percent') {
      const el = document.querySelector(selector);
      const m = text(el).match(/(\d+(?:[.,]\d+)?)\s*%/);
      return m ? number(m[1]) : null;
    }
    const el = document.querySelector(selector);
    if (!el) return null;
    if (kind === 'trailing-number') {
      const all = text(el).match(/-?\d+(?:[.,]\d+)?/g) ?? [];
      return all.length ? number(all[all.length - 1]) : null;
    }
    return number(text(el));
  }, ui as { selector: string; kind: string; label?: string });
}

export interface ApiClient {
  get: (path: string) => Promise<{ status: number; data: any; message?: string }>;
}

async function resolveRoute(route: string, api: ApiClient): Promise<string | null> {
  if (!route.includes(':firstOrderId')) return route;
  const response = await api.get('/api/dashboard/orders?page=0&size=1');
  const id = response.data?.content?.[0]?.id;
  return id ? route.replace(':firstOrderId', String(id)) : null;
}

/** Run every oracle; each mismatch is one finding. */
export async function runOracles(
  page: Page,
  baseUrl: string,
  api: ApiClient,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const oracle of ORACLES) {
    const route = await resolveRoute(oracle.route, api);
    if (!route) continue;
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1800);
    const uiValue = await readUi(page, oracle.ui).catch(() => null);
    const callPath = oracle.apiCall.replace(':firstOrderId', route.split('/').pop() ?? '');
    const response = await api.get(callPath);
    if (response.status >= 400) continue;
    const expected = oracle.transform(response.data);
    if (uiValue === null || expected === null) continue;
    const uiText = String(uiValue);
    const expectedText = String(expected);
    const same =
      typeof expected === 'number'
        ? Math.abs(uiValue - expected) <= 0.51
        : uiText === expectedText;
    if (same) continue;
    findings.push({
      detector: 'oracles',
      id: `oracles.${oracle.name}`,
      severity: oracle.severity,
      selector: oracle.ui.selector,
      message: 'The UI value disagrees with the API value.',
      evidence: `${route}: UI ${uiValue}, API ${expected}`,
      page: oracle.name,
      route,
      state: 'oracle',
      env: 'light/en/1440',
      screenshot: '',
    });
  }
  return findings;
}
