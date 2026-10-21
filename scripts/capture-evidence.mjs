// Capture the 4-cell evidence matrix ({light,dark} × {en,ar} at 1440x900) for
// the four tickets, plus the review-suite captures (Add/Edit dialog, Arabic UI,
// dark mode). One login per run — POST /api/auth/login is rate limited to
// 5/min per IP and per identifier (back off + retry on 429).
//
//   node scripts/capture-evidence.mjs tickets   # evidence/<ticket>/{4 cells} + measurements.json
//   node scripts/capture-evidence.mjs review    # evidence/review/**  (Add/Edit dialog, AR UI, dark mode)
//
// Credentials come from .env.local (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).
// Screenshots rendered with REAL account data — do not attach to public issues.
import { chromium } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const SUITE = process.argv[2] ?? 'tickets';
const OUT = resolve(process.cwd(), 'evidence');

const CELLS = [
  { name: 'light-en', lang: 'en', theme: 'light' },
  { name: 'dark-en', lang: 'en', theme: 'dark' },
  { name: 'light-ar', lang: 'ar', theme: 'light' },
  { name: 'dark-ar', lang: 'ar', theme: 'dark' },
];
const VIEWPORT = { width: 1440, height: 900 };

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();

async function login() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(BASE + '/login');
    await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
    await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    );
    await page.click('button[type="submit"]');
    const resp = await respPromise;
    if (resp.status() === 429) {
      console.log('login 429 — backing off 20s');
      await page.waitForTimeout(20_000);
      continue;
    }
    if (resp.ok()) {
      await page.waitForURL('**/dashboard', { timeout: 15_000 });
      return;
    }
    throw new Error(`login failed: ${resp.status()}`);
  }
  throw new Error('login stayed rate-limited (429) after 3 attempts');
}

/** Seeds the persisted cell (language + theme); the next load applies them. */
async function applyCell(cell) {
  await page.evaluate(
    ([lang, theme]) => {
      localStorage.setItem('language', lang);
      localStorage.setItem('nocteon-theme', theme);
    },
    [cell.lang, cell.theme],
  );
}

const shoot = (ticket, cell) =>
  page.screenshot({ path: `${OUT}/${ticket}/${cell.name}.png` });

const saveJson = (ticket, label, data) => {
  const file = `${OUT}/${ticket}/measurements-${label}.json`;
  mkdirSync(OUT + '/' + ticket, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 1));
  console.log(`  measurements → ${file.replace(OUT + '/', '')}`);
};

const settle = (ms = 800) => page.waitForTimeout(ms);

// ─── per-page robot helper: seeds cell, reloads, waits, focuses region ──────
async function visit(cell, path) {
  await applyCell(cell);
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await settle();
}

// ═══ TICKETS SUITE ════════════════════════════════════════════════════════════
if (SUITE === 'tickets') {
  await login();
  console.log('logged in');

  // ── T1: name-column gap on the categories list ──────────────────────────
  for (const cell of CELLS) {
    await visit(cell, '/dashboard/categories');
    await page.waitForSelector('table');
    await settle(400);
    const m = await page.evaluate(() => {
      const table = document.querySelector('table');
      const firstRow = table.querySelector('tbody tr');
      const texts = [];
      const walker = document.createTreeWalker(firstRow, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (!n.textContent?.trim()) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        const rect = r.getBoundingClientRect();
        if (rect.width > 0) texts.push({ x: rect.left, xEnd: rect.right, y: rect.top });
      }
      texts.sort((a, b) => a.x - b.x);
      let gap = 0;
      for (let i = 1; i < texts.length; i++) {
        if (Math.abs(texts[i].y - texts[i - 1].y) < 30) gap = Math.max(gap, texts[i].x - texts[i - 1].xEnd);
      }
      const ths = [...table.querySelectorAll('thead th')];
      return {
        tableW: Math.round(table.getBoundingClientRect().width),
        widestTextGapPx: Math.max(0, Math.round(gap)),
        headerWidths: ths.map((th) => Math.round(th.getBoundingClientRect().width)),
        headerDirs: ths.map((th) => th.getAttribute('dir')),
        uiDir: getComputedStyle(table).direction,
      };
    });
    m.gapOfTable = +(m.widestTextGapPx / m.tableW).toFixed(3);
    saveJson('t1-name-gap', cell.name, m);
    await shoot('t1-name-gap', cell);
    console.log(`  T1 ${cell.name}: gap ${m.widestTextGapPx}px / table ${m.tableW}px (${m.gapOfTable}) dir=${m.uiDir}`);
  }

  // ── T2: products TABLE on the coffee category (shared DataTable) ──────────
  for (const cell of CELLS) {
    await visit(cell, '/dashboard/categories/coffee');
    await page.waitForSelector('tbody tr');
    await settle(600);
    // focus the products table: scroll its heading to the top of the viewport
    await page.evaluate(() => {
      const h2 = [...document.querySelectorAll('h2')].find((e) => e.textContent.includes('Products') || e.textContent.includes('المنتجات'));
      h2?.scrollIntoView({ block: 'start' });
      window.scrollBy(0, 120);
    });
    await settle(300);
    const m = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('tbody tr')].slice(0, 6);
      return {
        rowCount: document.querySelectorAll('tbody tr').length,
        // Reintroduced-grid detectors: the holiday card's 4:3 image box and any
        // button whose aria-label says "grid" (EN or AR). Both must stay 0.
        gridCards: document.querySelectorAll('.aspect-\\[4\\/3\\]').length,
        viewToggle: [...document.querySelectorAll('button[aria-label]')].filter((b) =>
          /grid|شبك/i.test(b.getAttribute('aria-label') ?? ''),
        ).length,
        rows: rows.map((r) => {
          const img = r.querySelector('img');
          const box = img ? img.getBoundingClientRect() : null;
          return {
            name: r.querySelector('[data-testid="name-link"]')?.textContent?.trim() ?? null,
            slug: r.querySelector('[data-testid="slug-text"]')?.textContent?.trim() ?? null,
            thumbBox: box ? `${Math.round(box.width)}x${Math.round(box.height)}` : null,
            hasStar: !!r.querySelector('[role="img"][aria-label]'),
          };
        }),
      };
    });
    saveJson('t2-products-table', cell.name, m);
    await shoot('t2-products-table', cell);
    console.log(`  T2 ${cell.name}: rows ${m.rowCount} cards ${m.gridCards} toggle ${m.viewToggle}`);
  }

  // ── T3: category detail cards + Details panel (equipment: nothing featured) ─
  for (const cell of CELLS) {
    await visit(cell, '/dashboard/categories/equipment');
    await page.waitForSelector('hlm-card');
    // The products list is always the shared table now (no view toggle).
    await page.waitForSelector('table', { timeout: 15_000 }).catch(() => console.log('  !! no table rendered'));
    await page.evaluate(() => window.scrollTo(0, 150));
    await settle(300);
    const m = await page.evaluate(() => {
      const cols = document.querySelector('.grid.grid-cols-1');
      const cards = cols ? [...cols.querySelectorAll(':scope > hlm-card')] : [];
      const formCard = cards.find((c) => c.querySelector('form'));
      const formContent = formCard?.querySelector('[data-slot="card-content"]');
      // the switch row is the card content's last rendered block
      const blocks = [...(formContent?.children ?? [])].filter((e) => e.getBoundingClientRect().height > 0);
      const lastBlock = blocks[blocks.length - 1];
      const switchTrack = formCard?.querySelector('[data-slot="switch"] button, brn-switch button, button[role="switch"], [data-slot="switch"]');
      return {
        imageCardH: Math.round(cards[0]?.getBoundingClientRect().height ?? 0),
        formCardH: Math.round(cards[1]?.getBoundingClientRect().height ?? 0),
        deadUnderSwitchPx: lastBlock
          ? Math.round((formContent?.getBoundingClientRect().bottom ?? 0) - lastBlock.getBoundingClientRect().bottom)
          : null,
        switchTrackH: switchTrack ? Math.round(switchTrack.getBoundingClientRect().height) : null,
        deadUnderImageCardPx: cards[0] ? Math.round(cards[0].getBoundingClientRect().bottom - Math.max(...[...cards[0].querySelectorAll(':scope > *')].map((e) => e.getBoundingClientRect().bottom))) : null,
        detailsTitleToValuePx: (() => {
          const detailCard = [...document.querySelectorAll('hlm-card')].find((c) => c.querySelector('h2'));
          const title = detailCard?.querySelector('h2')?.getBoundingClientRect();
          const val = [...(detailCard?.querySelectorAll('p') ?? [])].find((p) => p.textContent.trim());
          return title && val ? Math.round(val.getBoundingClientRect().top - title.bottom) : null;
        })(),
        featuredColumnPresent: (() => {
          const table = document.querySelector('table');
          return table ? [...table.querySelectorAll('thead th')].some((th) => /featured|مميز/i.test(th.textContent)) : null;
        })(),
      };
    });
    saveJson('t3-category-detail', cell.name, m);
    await shoot('t3-category-detail', cell);
    console.log(`  T3 ${cell.name}: ${JSON.stringify(m)}`);
  }

  // ── T4: sidebar heights + multi-open groups (Catalog AND Settings) ────────
  for (const cell of CELLS) {
    await visit(cell, '/dashboard');
    await page.waitForSelector('hlm-sidebar');
    await settle(400);
    // open Catalog and Settings on top of whatever is already open → multi-open
    for (const label of ['Catalog', 'الكتالوج', 'Settings', 'الإعدادات']) {
      const btn = page.locator('button', { hasText: label }).first();
      if (await btn.count().catch(() => 0)) {
        const expanded = await btn.getAttribute('aria-expanded');
        if (expanded === 'false') await btn.click();
      }
    }
    await settle(500);
    const m = await page.evaluate(() => {
      const region = document.querySelector('hlm-sidebar-content') ?? document;
      const labels = [...region.querySelectorAll('button')].filter((b) => /CATALOG|SETTINGS|الكتالوج|الإعدادات|OPERATIONS|العمليات|CONTENT|المحتوى/i.test(b.textContent));
      // nav items: menu buttons inside the scroll region (excludes the header logo)
      const items = [...region.querySelectorAll('a[data-slot="sidebar-menu-button"]')].filter((a) => !a.classList.contains('h-12'));
      const groupHeader = labels[0];
      return {
        itemCount: items.length,
        firstItemH: items[0] ? Math.round(items[0].getBoundingClientRect().height) : null,
        groupHeaderH: groupHeader ? Math.round(groupHeader.getBoundingClientRect().height) : null,
        groupHeaderFontSizePx: groupHeader ? getComputedStyle(groupHeader).fontSize : null,
        groupHeaderColor: groupHeader ? getComputedStyle(groupHeader).color : null,
        openGroups: labels.filter((b) => b.getAttribute('aria-expanded') === 'true').map((b) => b.textContent.trim()),
      };
    });
    saveJson('t4-sidebar', cell.name, m);
    await shoot('t4-sidebar', cell);
    console.log(`  T4 ${cell.name}: ${JSON.stringify({ ...m, groupHeaderColor: undefined })}`);
  }
}

// ═══ REVIEW SUITE ═════════════════════════════════════════════════════════════
if (SUITE === 'review') {
  await login();
  console.log('logged in');

  for (const cell of CELLS) {
    await applyCell(cell);
    await page.goto(BASE + '/dashboard/categories', { waitUntil: 'domcontentloaded' });
    await settle();

    // Add dialog
    await page.locator('button', { hasText: cell.lang === 'ar' ? 'إضافة' : 'Add' }).first().click();
    await page.waitForSelector('[role="dialog"]');
    await settle(400);
    await page.screenshot({ path: `${OUT}/review/add-dialog/${cell.name}.png` });

    // Edit dialog: close Add, open the first row's Edit action
    await page.keyboard.press('Escape');
    await settle(300);
    const editBtn = page
      .locator('table tbody tr')
      .first()
      .locator('button')
      .filter({ has: page.locator('ng-icon[name="lucidePen"], ng-icon[name="lucidePencil"], ng-icon[name="lucideSquarePen"]') })
      .first();
    const actions = page.locator('table tbody tr').first().locator('td:last-child button');
    if (await editBtn.count()) await editBtn.click();
    else await actions.last().click();
    await page.waitForSelector('[role="dialog"]');
    await settle(400);
    await page.screenshot({ path: `${OUT}/review/edit-dialog/${cell.name}.png` });
    await page.keyboard.press('Escape');
    await settle(300);

    // Arabic UI + dark mode gallery: the products list ( representative page )
    await page.goto(BASE + '/dashboard/products', { waitUntil: 'domcontentloaded' });
    await settle();
    await page.screenshot({ path: `${OUT}/review/ui-products/${cell.name}.png` });
  }
}

await browser.close();
console.log(`${SUITE} suite done → ${OUT}`);
