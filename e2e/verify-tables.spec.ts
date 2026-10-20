import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * Data-table presentation E2E.
 *
 * Guards the shared DataTable contract (see data-table.component.ts
 * `columnWidths`) across the 4-cell matrix: {EN, AR} × {light, dark}.
 *
 * ── WHY THESE ASSERTIONS ───────────────────────────────────────────────────
 * `table-fixed` ignores content width, so a column with no explicit budget
 * absorbs the leftover and grows without limit. The `actions` column used to be
 * absent from the width map, which made it the widest column on most pages
 * (measured up to 562px). These tests pin the corrected invariants:
 *
 *   AC-T1 no visible `id` column             (technical key, human-hostile)
 *   AC-T2 actions stays compact              and is never the widest column
 *   AC-T3 entity thumbnails are rounded squares (8px); avatars stay circles
 *   AC-T4 the primary data column dominates the read; dates stay small
 *   AC-T5 no horizontal page overflow at 390 or 1440
 *
 * ── WHY ONE SHARED SESSION (not per-test logins) ───────────────────────────
 * Two independent constraints on the real stack forced this shape:
 *
 *  1. POST /api/auth/login is rate limited to 5/minute per IP *and* per
 *     identifier (bucket4j, RateLimiterService.loginBucketConfig). Logging in
 *     per test (or per matrix cell) rate-limits the suite against itself.
 *  2. The refresh token rotates on every refresh AND reuse detection revokes
 *     the whole token family. A second browser context replayed from a saved
 *     storageState therefore gets 401, and two overlapping page loads can trip
 *     reuse detection and log the session out.
 *
 * So: ONE context, ONE login, and strictly sequential page loads (each load is
 * awaited to a rendered table before the next begins). Theme/language are
 * changed through localStorage and re-applied by the *next* load — no reload
 * racing a navigation.
 *
 * ⚠ If a page load logs out mid-run, suspect overlap/reuse detection first, not
 *   the table component.
 */

const CELLS = [
  { name: 'EN light', lang: 'en', theme: 'light' },
  { name: 'EN dark', lang: 'en', theme: 'dark' },
  { name: 'AR light', lang: 'ar', theme: 'light' },
  { name: 'AR dark', lang: 'ar', theme: 'dark' },
] as const;

type Cell = (typeof CELLS)[number];

/**
 * `maxActions` and `minDominance` are per route and document real behaviour
 * rather than a pretend-uniform rule:
 *
 *  - `minDominance`: pages with a primary name column leave it unsized, so it
 *    absorbs the whole remainder and dominates actions by a wide margin.
 *  - `maxActions`: a table where EVERY column has an explicit budget has no flex
 *    column, so `table-fixed` spreads the leftover across all of them
 *    proportionally — the table fills its width evenly, actions included. The
 *    ceiling documents the resulting (still bounded, never dominant) size; the
 *    old bug was one column swallowing up to 562px.
 */
interface TableRoute {
  path: string;
  label: string;
  maxActions: number;
  hasThumbnail: boolean;
  /** Shape of the leading image column. Only read when `hasThumbnail`. */
  thumbnailShape?: 'square' | 'circle';
  minDominance: number;
}

const ROUTES: TableRoute[] = [
  // maxActions: 150 (was 130, raised per O1 on Oct 17 2026): the O1
  // proportional budgets (entity 30% + other-language 28%) make categories an
  // all-budgeted table — no flex column — so the leftover spreads
  // proportionally over every column (actions included), rendering ~148px.
  // This is the documented all-budgeted behaviour of the shared DataTable, not
  // an overflow: minDominance still holds (338/148 ≈ 2.28 >= 2.0).
  { path: '/dashboard/categories', label: 'categories', maxActions: 150, hasThumbnail: true, thumbnailShape: 'square', minDominance: 2.0 },
  { path: '/dashboard/origins', label: 'origins', maxActions: 130, hasThumbnail: true, thumbnailShape: 'square', minDominance: 2.0 },
  { path: '/dashboard/users', label: 'users', maxActions: 130, hasThumbnail: true, thumbnailShape: 'circle', minDominance: 2 },
  { path: '/dashboard/products', label: 'products', maxActions: 130, hasThumbnail: true, thumbnailShape: 'square', minDominance: 2.5 },
  { path: '/dashboard/carts', label: 'carts', maxActions: 130, hasThumbnail: false, minDominance: 2.5 },
  { path: '/dashboard/promo-codes', label: 'promo-codes', maxActions: 180, hasThumbnail: false, minDominance: 1.2 },
  { path: '/dashboard/orders', label: 'orders', maxActions: 200, hasThumbnail: false, minDominance: 1.1 },
  { path: '/dashboard/store-settings', label: 'store-settings', maxActions: 300, hasThumbnail: false, minDominance: 1 },
  // The reviews console: the product cell is the ONE unsized column, so it
  // absorbs the remainder and dominates the actions column by a wide margin.
  { path: '/dashboard/reviews', label: 'reviews', maxActions: 160, hasThumbnail: true, thumbnailShape: 'square', minDominance: 1.4 },
];

/** Dates render through the shared localized-date element at text-xs (12px). */
const DATE_FONT_PX = 12;

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

interface ColumnMetric {
  header: string;
  width: number;
}

interface TableMetric {
  hasIdColumn: boolean;
  actionsWidth: number;
  widestDataWidth: number;
  widestDataHeader: string;
  thumbnailRadiusPx: number;
  thumbnailWidthPx: number;
  thumbnailHeightPx: number;
  dateFontPx: number | null;
  overflowPx: number;
  /** Widest horizontal whitespace between two consecutive text runs on the
   *  first data row (text-node to text-node, getBoundingClientRect). */
  widestTextGapPx: number;
  tableWidthPx: number;
}

async function measureTable(page: Page): Promise<TableMetric> {
  return page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) throw new Error('no table rendered');

    const ths = [...table.querySelectorAll('thead th')];
    const firstRow = table.querySelector('tbody tr');

    const columns: ColumnMetric[] = ths.map((th) => ({
      header: (th.textContent ?? '').trim().replace(/\s+/g, ' '),
      width: Math.round(th.getBoundingClientRect().width),
    }));

    // Actions header is localized (common.actions): "Actions" / "الإجراءات".
    const isActions = (header: string) => /(actions|الإجراءات)/i.test(header);

    const dataColumns = columns.filter((c) => !isActions(c.header));
    const widest = dataColumns.reduce((best, c) => (c.width > best.width ? c : best), {
      header: '',
      width: 0,
    });

    // First cell that renders a thumbnail/swatch (image cell or main cell).
    const thumb = firstRow?.querySelector('td img, td div[class*="rounded"]');
    const thumbRect = thumb?.getBoundingClientRect();

    const dateCell = firstRow?.querySelector('td app-localized-date span');

    // O1 measurement: the horizontal whitespace between two consecutive text
    // runs on the first data row, measured on TEXT NODES (Range rects), not on
    // cell boxes. A huge gap means a name column swallowed the row again.
    let widestTextGapPx = 0;
    if (firstRow) {
      const texts: { x: number; xEnd: number; y: number }[] = [];
      const walker = document.createTreeWalker(firstRow, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0) texts.push({ x: rect.left, xEnd: rect.right, y: rect.top });
      }
      texts.sort((a, b) => a.x - b.x);
      for (let i = 1; i < texts.length; i++) {
        if (Math.abs(texts[i].y - texts[i - 1].y) < 30) {
          widestTextGapPx = Math.max(widestTextGapPx, texts[i].x - texts[i - 1].xEnd);
        }
      }
      widestTextGapPx = Math.max(0, Math.round(widestTextGapPx));
    }

    return {
      // `common.id` renders as "ID" (en) or "المعرّف" (ar) — an Arabic run that
      // regex on Latin "ID" alone would silently miss.
      hasIdColumn: columns.some((c) => /^ID\b/i.test(c.header) || c.header === 'المعرّف'),
      actionsWidth: columns.find((c) => isActions(c.header))?.width ?? -1,
      widestDataWidth: widest.width,
      widestDataHeader: widest.header,
      thumbnailRadiusPx: thumb ? parseFloat(getComputedStyle(thumb).borderRadius) || 0 : 0,
      thumbnailWidthPx: thumbRect ? thumbRect.width : 0,
      thumbnailHeightPx: thumbRect ? thumbRect.height : 0,
      dateFontPx: dateCell ? parseFloat(getComputedStyle(dateCell).fontSize) : null,
      overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      widestTextGapPx,
      tableWidthPx: Math.round(table.getBoundingClientRect().width),
    };
  });
}

/** Loads a table page and waits for it to render. Awaited before the next load. */
async function openTable(page: Page, path: string): Promise<TableMetric> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(
    page.locator('table'),
    `no table rendered at ${path} (did the session survive?)`,
  ).toBeVisible();
  // Let the localized-date children settle before measuring font sizes.
  await page.waitForTimeout(500);
  return measureTable(page);
}

/** Seeds the persisted language + theme; the next load picks them up. */
async function applyCell(page: Page, cell: Cell): Promise<void> {
  await page.evaluate(
    ([lang, theme]) => {
      localStorage.setItem('language', lang);
      localStorage.setItem('nocteon-theme', theme);
    },
    [cell.lang, cell.theme],
  );
}

function assertTableContract(
  m: TableMetric,
  where: string,
  maxActions: number,
  minDominance: number,
  hasThumbnail: boolean,
  thumbnailShape: 'square' | 'circle',
): void {
  // AC-T1 — the technical id column is reference noise, never rendered.
  expect(m.hasIdColumn, `${where}: an "ID" column is visible`).toBe(false);

  // AC-T2 — actions is bounded and never the widest column.
  expect(m.actionsWidth, `${where}: no actions column found`).toBeGreaterThan(0);
  expect(m.actionsWidth, `${where}: actions column is too wide`).toBeLessThanOrEqual(maxActions);
  expect(
    m.actionsWidth,
    `${where}: actions (${m.actionsWidth}px) should not beat the widest data column ` +
      `"${m.widestDataHeader}" (${m.widestDataWidth}px)`,
  ).toBeLessThan(m.widestDataWidth);

  // AC-T4 — the column the reader scans dominates the layout.
  expect(
    m.widestDataWidth,
    `${where}: the widest data column "${m.widestDataHeader}" (${m.widestDataWidth}px) ` +
      `should dominate actions (${m.actionsWidth}px) by >= ${minDominance}x`,
  ).toBeGreaterThan(m.actionsWidth * minDominance);

  // AC-T4b (O1) — the widest whitespace between two consecutive text runs must
  // stay inside the two name columns' combined share (+ generous slack). A gap
  // above 0.65 of the table means a name column absorbed the row again and the
  // reader's eye has to cross dead space to find the next datum. With the O1
  // proportional budgets (entity ~30% + other language ~28%) the real gap on
  // categories at 1440 is ~504px of a 1126px table (≈0.45) — measured on text
  // nodes in all four cells.
  expect(
    m.widestTextGapPx,
    `${where}: text-to-text whitespace is ${m.widestTextGapPx}px of a ` +
      `${m.tableWidthPx}px table (>65%) — a name column is swallowing the row`,
  ).toBeLessThanOrEqual(Math.round(m.tableWidthPx * 0.65));

  // AC-T3 — the shape of a table's leading image is deliberate, not incidental.
  // Entity thumbnails (categories, origins, products) are rounded SQUARES at the
  // 8px control radius; the user avatar column stays a CIRCLE. Circles read as
  // people, so using one for a product would mislabel it. Text-only tables
  // (e.g. promo-codes) have no such column to check.
  //
  // The square-box check is not redundant: `border-radius: 9999px` on a 24x40
  // box still reports a radius larger than half the WIDTH, so a radius
  // assertion alone passed while real <img> thumbnails were being squashed into
  // vertical ellipses by Tailwind preflight's `img { max-width: 100% }`.
  if (hasThumbnail) {
    expect(m.thumbnailWidthPx, `${where}: no thumbnail cell found`).toBeGreaterThan(0);
    expect(
      Math.abs(m.thumbnailWidthPx - m.thumbnailHeightPx),
      `${where}: thumbnail box is ${m.thumbnailWidthPx}x${m.thumbnailHeightPx} — not square`,
    ).toBeLessThanOrEqual(1);
    if (thumbnailShape === 'circle') {
      expect(
        m.thumbnailRadiusPx,
        `${where}: avatar border-radius ${m.thumbnailRadiusPx}px is not a circle in a ` +
          `${m.thumbnailWidthPx}px box`,
      ).toBeGreaterThanOrEqual(m.thumbnailWidthPx / 2);
    } else {
      expect(
        m.thumbnailRadiusPx,
        `${where}: thumbnail border-radius ${m.thumbnailRadiusPx}px should be the 8px ` +
          `control radius (--radius-control), not a circle`,
      ).toBeCloseTo(8, 0);
    }
  }

  // AC-T5 — the table scrolls inside its own wrapper, not the page.
  expect(m.overflowPx, `${where}: page overflows horizontally`).toBeLessThanOrEqual(1);
}

/**
 * Logs in as the admin, tolerating the real login rate limit.
 *
 * POST /api/auth/login allows 5/minute per IP *and* per identifier. A 429 is
 * correct server behaviour, not a product defect, so back off and retry rather
 * than reporting a false failure.
 */
async function loginAsAdmin(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await gotoLogin(page);
    await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
    const result = await submitLogin(page);

    if (result.status === 429) {
      await page.waitForTimeout(20_000);
      continue;
    }

    expect(result.role, 'the table suite requires an ADMIN account').toBe('ADMIN');
    return;
  }

  throw new Error('login stayed rate-limited (429) after 3 attempts');
}

test.describe('Data table presentation', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: DESKTOP });
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  for (const cell of CELLS) {
    test(`${cell.name}: list tables honour the width + identity contract`, async () => {
      await applyCell(page, cell);

      for (const route of ROUTES) {
        const m = await openTable(page, route.path);
        assertTableContract(
          m,
          `${cell.name} ${route.label}`,
          route.maxActions,
          route.minDominance,
          route.hasThumbnail,
          route.thumbnailShape ?? 'square',
        );
      }
    });
  }

  test('EN light: dates render small and tables never overflow the page', async () => {
    await applyCell(page, CELLS[0]);
    await page.setViewportSize(DESKTOP);

    // AC-T4 — dates are text-xs (≈12px) on the pages that render one.
    for (const path of ['/dashboard/categories', '/dashboard/origins']) {
      const m = await openTable(page, path);
      expect(m.dateFontPx, `${path}: no localized date cell found`).not.toBeNull();
      expect(m.dateFontPx, `${path}: date font is too large`).toBeLessThanOrEqual(DATE_FONT_PX);
    }

    // AC-T5 — reflow to mobile width without reloading the page.
    await page.setViewportSize(MOBILE);
    for (const route of ROUTES) {
      const m = await openTable(page, route.path);
      expect(
        m.overflowPx,
        `${route.label} at 390px: page overflows horizontally by ${m.overflowPx}px`,
      ).toBeLessThanOrEqual(1);
    }

    await page.setViewportSize(DESKTOP);
  });
});
