// Phase 6 measurements — responsive behaviour and the before/after sheet.
//
//   node scripts/measure-phase6.mjs
//
// Writes evidence/phase6/measurements.json: the grid columns per width, the
// horizontal overflow and the clipped text at every width, in both languages.

import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const OUT = resolve(process.cwd(), 'evidence/phase6');

const { chromium } = await import('playwright');

const WIDTHS = [375, 768, 1024, 1440, 1920];
const LANGS = ['en', 'ar'];

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext();
await context.route('**/__seed', (r) =>
  r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }),
);
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
await page.waitForTimeout(2000);

const results = [];

for (const lang of LANGS) {
  await page.goto(`${BASE}/__seed`);
  await page.evaluate((l) => localStorage.setItem('language', l), lang);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/dashboard?days=30`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      // The KPI grid: how many columns does it actually have?
      const kpiGrid = document.querySelector('app-dashboard .grid');
      const kpiCards = kpiGrid ? kpiGrid.querySelectorAll('app-kpi-card').length : 0;
      const kpiTops = [...(kpiGrid?.querySelectorAll('app-kpi-card') ?? [])].map(
        (c) => Math.round(c.getBoundingClientRect().top),
      );
      // The distinct ROWS the cards are on; the columns are the cards
      // divided by the rows.
      const kpiRows = new Set(kpiTops).size || 1;
      const kpiColumns = kpiCards ? Math.round(kpiCards / kpiRows) : 0;

      // The secondary strip.
      const strips = [...document.querySelectorAll('app-dashboard .grid')];
      const strip = strips[1];
      const stripCards = strip ? strip.querySelectorAll('hlm-card').length : 0;
      const stripRows = strip
        ? new Set(
            [...strip.querySelectorAll('hlm-card')].map((c) =>
              Math.round(c.getBoundingClientRect().top),
            ),
          ).size || 1
        : 1;
      const stripColumns = stripCards ? Math.round(stripCards / stripRows) : 0;

      // Clipped text: an element whose content is wider than its box and
      // which is NOT deliberately truncated.
      const clipped = [];
      for (const el of document.querySelectorAll(
        'app-dashboard hlm-card *, app-dashboard hlm-card',
      )) {
        if (el.children.length) continue;
        const text = (el.textContent || '').trim();
        if (!text) continue;
        if (el.scrollWidth > el.clientWidth + 1) {
          const cls = el.className || '';
          clipped.push({
            text: text.slice(0, 40),
            intentional: /truncate|line-clamp/.test(cls),
          });
        }
      }

      // The charts stack: are the chart cards on one row or on separate rows?
      const chartCards = [...document.querySelectorAll('app-dashboard hlm-card')].filter(
        (c) => c.querySelector('app-chart-card, app-revenue-chart'),
      );
      const chartRows = new Set(
        chartCards.map((c) => Math.round(c.getBoundingClientRect().top)),
      ).size;

      // The tabs must fit: a tab strip that overflows scrolls.
      const tabStrips = [...document.querySelectorAll('[role="tablist"]')].map((t) => ({
        scrollWidth: t.scrollWidth,
        clientWidth: t.clientWidth,
        scrolls: t.scrollWidth > t.clientWidth + 1,
      }));

      return {
        pageHeight: de.scrollHeight,
        horizontalOverflowPx: de.scrollWidth - de.clientWidth,
        kpiCards,
        kpiColumns,
        stripColumns,
        chartRows,
        tabStrips,
        clipped: clipped.filter((c) => !c.intentional),
        clippedCount: clipped.filter((c) => !c.intentional).length,
      };
    });
    results.push({ lang, width, ...r });
    console.log(
      `${lang} @${width}: overflow=${r.horizontalOverflowPx}px kpiCols=${r.kpiColumns} stripCols=${r.stripColumns} chartRows=${r.chartRows} clipped=${r.clippedCount} h=${r.pageHeight}`,
    );
  }
}

await browser.close();

const measurements = {
  observedAt: new Date().toISOString(),
  rule: {
    kpiGrid: '4 columns -> 2 -> 1',
    strip: 'the secondary strip wraps',
    charts: 'the chart cards stack',
    tabs: 'a tab strip that does not fit scrolls horizontally',
    overflow: 'no horizontal page scroll at 375 or 768',
  },
  results,
  summary: {
    widths: WIDTHS,
    languages: LANGS,
    anyHorizontalOverflow: results.filter((r) => r.horizontalOverflowPx > 0).map(
      (r) => `${r.lang}@${r.width}: ${r.horizontalOverflowPx}px`,
    ),
    anyClippedText: results.filter((r) => r.clippedCount > 0).map(
      (r) => `${r.lang}@${r.width}: ${JSON.stringify(r.clipped)}`,
    ),
    kpiColumnsByWidth: Object.fromEntries(
      WIDTHS.map((w) => [
        w,
        results.filter((r) => r.width === w).map((r) => `${r.lang}:${r.kpiColumns}`),
      ]),
    ),
  },
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(measurements, null, 2));
console.log('measurements -> evidence/phase6/measurements.json');
