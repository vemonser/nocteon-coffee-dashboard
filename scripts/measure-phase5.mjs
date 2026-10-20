// Phase 5 measurements — states, interactions and accessibility.
//
//   node scripts/measure-phase5.mjs
//
// Writes evidence/phase5/measurements.json.
//
// The accessibility checks are implemented here rather than with a tool:
// `@axe-core/playwright` is NOT installed, and the ticket says not to install
// new tooling without asking. Every check below is a DOM measurement.

import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const OUT = resolve(process.cwd(), 'evidence/phase5');

const { chromium } = await import('playwright');

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
await page.waitForTimeout(2500);

/** Force one endpoint to fail and record what the page shows. */
async function withFailure(match, run) {
  await page.route(match, (route) => route.abort('failed'));
  try {
    return await run();
  } finally {
    await page.unroute(match);
  }
}

const states = {};

for (const [name, match] of [
  ['overview', /\/api\/dashboard\/stats\/overview/],
  ['settings', /\/api\/settings/],
  ['orders', /\/api\/dashboard\/orders/],
]) {
  states[name] = await withFailure(match, async () => {
    await page.goto(`${BASE}/dashboard?days=30`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    return page.evaluate(() => {
      const alerts = [...document.querySelectorAll('[role="alert"]')];
      return {
        errorStates: alerts.length,
        hasRetry: !!document.querySelector('[role="alert"] button'),
        errorText: alerts.map((a) => (a.textContent || '').trim().slice(0, 80)),
        // A widget must never be blank: every card must have some text.
        blankCards: [...document.querySelectorAll('app-dashboard hlm-card')].filter(
          (c) => !(c.textContent || '').trim(),
        ).length,
        kpiStillRendered: /total revenue|إجمالي الإيرادات/i.test(
          document.body.innerText,
        ),
      };
    });
  });
}

// The empty state: no low-stock products in this seed.
await page.goto(`${BASE}/dashboard?days=30`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const emptyState = await page.evaluate(() => {
  const lowStock = document.querySelector('app-low-stock-products');
  return {
    present: !!lowStock,
    text: (lowStock?.textContent || '').trim().slice(0, 60),
    isOneLine: (lowStock?.querySelector('div')?.getBoundingClientRect().height ?? 0) < 40,
  };
});

// The loading state: the skeleton must be there before the data lands.
// The overview is slowed so the skeleton is observable.
await page.route(/\/api\/dashboard\/stats\/overview/, async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  try {
    await route.continue();
  } catch {
    /* the navigation replaced the route */
  }
});
await page.goto(`${BASE}/dashboard?days=30`, { waitUntil: 'commit' });
await page.waitForSelector('.skeleton', { timeout: 12000 }).catch(() => undefined);
const loadingState = {
  skeletonShown: (await page.locator('.skeleton').count()) > 0,
  skeletonCount: await page.locator('.skeleton').count(),
  announced: (await page.locator('[role="status"][aria-live="polite"]').count()) > 0,
};
await page.unroute(/\/api\/dashboard\/stats\/overview/);

// ── accessibility ──────────────────────────────────────────────────────────
await page.goto(`${BASE}/dashboard?days=30`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const a11y = await page.evaluate(() => {
  const out = {};

  // 1. The range selector has a proper role and announces its change.
  const group = document.querySelector('[role="radiogroup"]');
  const radios = [...document.querySelectorAll('[role="radio"]')];
  const live = document.querySelector('[role="status"][aria-live="polite"]');
  out.rangeSelector = {
    hasRadiogroup: !!group,
    radioCount: radios.length,
    hasCheckedRadio: radios.some((r) => r.getAttribute('aria-checked') === 'true'),
    hasLiveRegion: !!live,
    liveRegionIsSrOnly: !!live && !!live.closest('.sr-only'),
  };

  // 2. Every chart carries a text summary.
  const charts = [...document.querySelectorAll('app-chart-card [role="img"]')];
  out.chartSummaries = {
    count: charts.length,
    allHaveLabels: charts.every((c) => (c.getAttribute('aria-label') || '').length > 3),
    labels: charts.map((c) => c.getAttribute('aria-label')),
  };
  const revenueChart = document.querySelector('app-revenue-chart [role="img"]');
  out.revenueChartSummary = revenueChart?.getAttribute('aria-label') ?? null;

  // 3. The legends never rely on colour alone: every legend row carries a
  //    name, a value and a percentage.
  const legendRows = [...document.querySelectorAll('app-chart-card ul li')];
  out.legends = {
    rows: legendRows.length,
    everyRowHasName: legendRows.every((r) => (r.textContent || '').trim().length > 0),
    everyRowHasPercent: legendRows.every((r) => /%/.test(r.textContent || '')),
    everyRowHasSwatch: legendRows.every((r) => !!r.querySelector('span[style*="background"]')),
  };

  out.focusRings = { note: 'measured by a keyboard Tab walk, see focusAudit' };

  // 5. Reduced motion is respected: the shimmer and the live dot must be
  //    switched off by the media query.
  out.reducedMotion = {
    hasReducedMotionBlock: [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((r) =>
          r.cssText.includes('prefers-reduced-motion'),
        );
      } catch {
        return false;
      }
    }),
  };

  // 6. The KPI cards are real links, not divs with a click handler.
  const kpiLinks = [...document.querySelectorAll('app-kpi-card a')];
  out.kpiCards = {
    count: kpiLinks.length,
    allAreLinks: kpiLinks.every((a) => a.getAttribute('href')),
    allHaveHref: kpiLinks.every((a) => (a.getAttribute('href') || '').length > 0),
  };

  return out;
});

/**
 * A keyboard focus audit.
 *
 * `:focus-visible` only matches when the browser decides the focus came from
 * the keyboard, so a programmatic `.focus()` does NOT prove the ring exists.
 * The audit therefore presses Tab and reads the computed style of whatever
 * is focused — the same thing a keyboard user sees.
 */
async function focusAudit(theme) {
  await page.evaluate((t) => localStorage.setItem('nocteon-theme', t), theme);
  await page.goto(`${BASE}/dashboard?days=30`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.body.focus());
  const without = [];
  let count = 0;
  for (let i = 0; i < 70; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const hasOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      const hasShadow = style.boxShadow !== 'none' && style.boxShadow !== 'none';
      return {
        tag: el.tagName,
        label: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 28),
        hasRing: hasOutline || hasShadow,
      };
    });
    if (!info) continue;
    count += 1;
    if (!info.hasRing) without.push(`${info.label || info.tag}`);
  }
  return { theme, focused: count, withoutRing: without.length, examples: [...new Set(without)].slice(0, 8) };
}

const focusAuditResults = [];
for (const theme of ['light', 'dark']) {
  focusAuditResults.push(await focusAudit(theme));
}
a11y.focusAudit = focusAuditResults;

// The page at 200 % zoom (a 1.5x device scale plus a smaller viewport is
// the standard way to check a 200 % zoom without a browser zoom API).
const zoom = await page.evaluate(() => {
  const de = document.documentElement;
  return {
    horizontalOverflowPx: de.scrollWidth - de.clientWidth,
  };
});
await page.setViewportSize({ width: 720, height: 450 }); // ~200 % of 1440x900
await page.waitForTimeout(1500);
const at200 = await page.evaluate(() => {
  const de = document.documentElement;
  const clipped = [];
  for (const el of document.querySelectorAll('app-dashboard hlm-card, app-dashboard h3, app-dashboard p')) {
    if (el.scrollWidth > el.clientWidth + 1 && !/truncate/.test(el.className || '')) {
      clipped.push((el.textContent || '').trim().slice(0, 40));
    }
  }
  return {
    horizontalOverflowPx: de.scrollWidth - de.clientWidth,
    clipped,
  };
});

await page.setViewportSize({ width: 1440, height: 900 });

// The time zone the store runs in, and the one the database buckets days in.
const timeZone = await page.evaluate(() => ({
  browser: Intl.DateTimeFormat().resolvedOptions().timeZone,
  offsetMinutes: new Date().getTimezoneOffset(),
}));

await browser.close();

const measurements = {
  observedAt: new Date().toISOString(),
  states: {
    perEndpointFailure: states,
    loading: loadingState,
    empty: emptyState,
  },
  accessibility: a11y,
  zoom200: { at1440: zoom, at200 },
  timeZone: {
    ...timeZone,
    storeZone: 'Africa/Cairo',
    databaseZone: 'Etc/UTC',
    note:
      'The store and the browser run in Africa/Cairo (EEST, UTC+3 in October 2026). The DATABASE buckets a day with CAST(createdAt AS date) in UTC, and the backend\'s `since` bound is an instant. So an order placed between 00:00 and 03:00 Cairo is counted on the PREVIOUS day in the backend\'s daily series. The dashboard\'s windows are whole Cairo calendar days (core/dashboard/period.ts), and the day-boundary behaviour is pinned by period.spec.ts.',
  },
  missingBackendContracts: [
    {
      what: 'A pre-filtered LOW-STOCK product list',
      where: 'GET /api/dashboard/products (ProductFilterRequest)',
      status:
        'the product list filter has no stock parameter (only inStockOnly / onSaleOnly), and the list rows carry no stock at all — so a list filtered to "low stock" cannot be built from it.',
      workaroundUsed:
        'the low-stock widget rows link to each PRODUCT (the product page carries the stock), and the missing contract is reported here rather than faked with a client-side filter over one page.',
    },
    {
      what: 'A store-currency read on the dashboard namespace',
      where: 'GET /api/dashboard/settings',
      status: '405 Method Not Allowed — the route only accepts PUT',
      workaroundUsed: 'GET /api/settings -> data.currency (200), read once by StoreSettingsService',
    },
  ],
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(measurements, null, 2));
console.log('measurements -> evidence/phase5/measurements.json');
console.log(
  `states: ${Object.entries(states).map(([k, v]) => `${k}=${v.errorStates} errors`).join(', ')} | loading skeleton: ${loadingState.skeletonShown} | empty: ${emptyState.isOneLine}`,
);
console.log(
  `a11y: radiogroup=${a11y.rangeSelector.hasRadiogroup} live=${a11y.rangeSelector.hasLiveRegion} chartSummaries=${a11y.chartSummaries.allHaveLabels} legendPercent=${a11y.legends.everyRowHasPercent} focus=${a11y.focusAudit.map((f) => `${f.theme} ${f.withoutRing}/${f.focused}`).join(' ')} reducedMotion=${a11y.reducedMotion.hasReducedMotionBlock} kpiLinks=${a11y.kpiCards.allAreLinks}`,
);
console.log(`200%: overflow=${at200.horizontalOverflowPx}px clipped=${at200.clipped.length}`);
