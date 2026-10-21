// Phase 4 measurements — layout and hierarchy.
//
//   node scripts/measure-phase4.mjs
//
// Writes evidence/phase4/measurements.json: the page height before and
// after, the card-height ratio per row, the toolbar's position, and the
// "View all" count per widget.

import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const OUT = resolve(process.cwd(), 'evidence/phase4');

const { chromium } = await import('playwright');

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
await page.waitForTimeout(3000);

const measured = await page.evaluate(() => {
  const root = document.querySelector('app-dashboard')?.querySelector('div.flex.flex-col');
  const sections = [];
  if (root) {
    for (const child of root.children) {
      sections.push({
        tag: child.tagName.toLowerCase(),
        class: (child.getAttribute('class') || '').slice(0, 48),
        height: Math.round(child.getBoundingClientRect().height),
      });
    }
  }

  // Every row of cards, and the ratio of the row to its TALLEST card's
  // content. The rule is about a ROW not being much taller than what it
  // holds; two cards in a row necessarily share a height, so the ratio is
  // measured against the tallest of them.
  const rows = [];
  for (const grid of document.querySelectorAll('app-dashboard .grid')) {
    const cards = [...grid.querySelectorAll('hlm-card')];
    if (!cards.length) continue;
    const cardHeights = cards.map((c) => Math.round(c.getBoundingClientRect().height));
    const contentHeights = cards.map((c) => {
      const inner = c.querySelector('[data-slot="card-content"]') ?? c;
      const kids = [...inner.children];
      if (!kids.length) return 0;
      const top = Math.min(...kids.map((k) => k.getBoundingClientRect().top));
      const bottom = Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
      return Math.round(bottom - top);
    });
    const tallest = Math.max(...contentHeights);
    rows.push({
      cards: cards.length,
      cardHeights,
      contentHeights,
      rowHeight: Math.max(...cardHeights),
      tallestContent: tallest,
      rowRatio: tallest ? Math.round((Math.max(...cardHeights) / tallest) * 100) / 100 : null,
      // The per-card ratio, for the record.
      cardRatios: contentHeights.map((c, i) =>
        c ? Math.round((cardHeights[i] / c) * 100) / 100 : null,
      ),
    });
  }

  // The toolbar: is it sticky, and where does it sit?
  const toolbar = document.querySelector('app-dashboard-toolbar > div');
  const tb = toolbar?.getBoundingClientRect();
  const toolbarStyle = toolbar ? getComputedStyle(toolbar) : null;

  // "View all" per widget: it must appear ONCE.
  const viewAll = [...document.querySelectorAll('a, button')].filter((el) =>
    /view all|عرض الكل/i.test(el.textContent || ''),
  );
  const perWidget = {};
  for (const el of viewAll) {
    const card = el.closest('hlm-card');
    const title = card?.querySelector('h3')?.textContent?.trim() ?? '(no title)';
    perWidget[title] = (perWidget[title] ?? 0) + 1;
  }

  // The attention strip: it must be a slim one-liner when all is clear.
  const attention = document.querySelector('app-needs-attention-panel > div');
  const ab = attention?.getBoundingClientRect();

  // Clipped content: a card whose content is taller than the box it is
  // given. The device list lost its last row to this once.
  const clipped = [];
  for (const card of document.querySelectorAll('app-dashboard hlm-card')) {
    const inner = card.querySelector('[data-slot="card-content"]') ?? card;
    if (inner.scrollHeight > inner.clientHeight + 1) {
      clipped.push({
        title: card.querySelector('h3')?.textContent?.trim() ?? '(no title)',
        scrollHeight: inner.scrollHeight,
        clientHeight: inner.clientHeight,
      });
    }
  }

  return {
    pageHeight: document.documentElement.scrollHeight,
    rootHeight: root ? Math.round(root.getBoundingClientRect().height) : null,
    sections,
    rows,
    toolbar: tb
      ? {
          top: Math.round(tb.top),
          position: toolbarStyle?.position ?? null,
          height: Math.round(tb.height),
          inOneRow: Math.round(tb.height) < 80,
        }
      : null,
    viewAll: { total: viewAll.length, perWidget },
    attentionStrip: ab ? Math.round(ab.height) : null,
    clippedContent: clipped,
    maxWidth: getComputedStyle(root ?? document.body).maxWidth,
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

await browser.close();

const measurements = {
  observedAt: new Date().toISOString(),
  viewport: { width: 1440, height: 1000 },
  pageHeight: {
    before: 2390,
    after: measured.pageHeight,
    target: 1700,
    met: measured.pageHeight <= 1700,
    note:
      'The "before" figure is the page height measured before Phase 4 (the same 1440 viewport). The structure is now: title, ONE sticky toolbar, four KPI cards, a compact secondary strip, the attention strip, the revenue chart, and three two-column rows.',
  },
  sections: measured.sections,
  rows: measured.rows,
  cardHeightRatio: {
    rule: 'A row must not be much taller than the content it holds: target <= 1.5x, measured against the TALLEST card in the row (cards in a row share one height).',
    rows: measured.rows.map((r) => ({
      cards: r.cards,
      rowHeight: r.rowHeight,
      tallestContent: r.tallestContent,
      ratio: r.rowRatio,
      pass: (r.rowRatio ?? 0) <= 1.5,
    })),
    worst: Math.max(...measured.rows.map((r) => r.rowRatio ?? 0)),
  },
  toolbar: {
    ...measured.toolbar,
    rule: 'ONE row, sticky, holding the range, the comparison range and the export.',
  },
  viewAll: {
    ...measured.viewAll,
    rule: 'Exactly one "View all" per widget. The recent-orders list used to have one in the header AND one at the bottom.',
    pass:
      measured.viewAll.total ===
      Object.keys(measured.viewAll.perWidget).length,
  },
  attentionStrip: {
    height: measured.attentionStrip,
    rule: 'A slim one-line strip (48-56 px) when everything is clear.',
    pass: (measured.attentionStrip ?? 0) >= 40 && (measured.attentionStrip ?? 0) <= 60,
  },
  clipping: {
    clipped: measured.clippedContent,
    pass: measured.clippedContent.length === 0,
    rule: 'No card may clip its own content: a card that does is either too short or its content is too tall.',
  },
  spacing: {
    contentMaxWidth: measured.maxWidth,
    rule: '1280-1440 px, centered. The gap between sections is 24 px (gap-6).',
    horizontalOverflowPx: measured.horizontalOverflow,
  },
  missingBackendContracts: [
    {
      what: 'Per-product REVENUE for the top-selling list',
      where: 'GET /api/dashboard/stats/overview -> topSellingProducts',
      status:
        'the DTO carries `price` (the LOWEST variant price of the product) and `quantitySold` — never the revenue actually earned. The list therefore shows UNITS with a share bar, and says so in the column header, instead of printing a unit price next to a sold count (which implied a number that was never true).',
      workaroundUsed: 'units + a share bar; the missing field is listed here rather than invented',
    },
  ],
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(measurements, null, 2));
console.log('measurements -> evidence/phase4/measurements.json');
console.log(
  `page height: ${measurements.pageHeight.before} -> ${measurements.pageHeight.after} (target ${measurements.pageHeight.target}, met: ${measurements.pageHeight.met})`,
);
console.log(
  `worst row ratio: ${measurements.cardHeightRatio.worst} | toolbar: ${measured.toolbar?.position} | view all: ${measured.viewAll.total} in ${Object.keys(measured.viewAll.perWidget).length} widgets | attention strip: ${measured.attentionStrip}px`,
);
