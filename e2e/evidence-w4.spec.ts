import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import fs from 'fs';

const EVIDENCE = 'evidence/W4';
const WIDTHS = [375, 768, 1440, 1920];

test.describe('W4 evidence', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      if (result.status === 429) {
        await page.waitForTimeout(20_000);
        continue;
      }
      expect(result.role).toBe('ADMIN');
      return;
    }
    throw new Error('login stayed rate-limited (429) after 3 attempts');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  async function setLangTheme(lang: string, theme: string): Promise<void> {
    await page.evaluate(([l, t]) => {
      localStorage.setItem('language', l as string);
      localStorage.setItem('nocteon-theme', t as string);
    }, [lang, theme]);
  }

  async function contentWidth(): Promise<number> {
    // The page root container (the max-w-[1440px] element every list/detail page has).
    return page.evaluate(() => {
      const el = document.querySelector('main [class*="max-w-[1440px]"], main [class*="max-w-7xl"]');
      if (!el) return -1;
      const r = el.getBoundingClientRect();
      return Math.round(r.width);
    });
  }

  async function capture(path: string, name: string): Promise<void> {
    for (const lang of ['en', 'ar']) {
      for (const theme of ['light', 'dark']) {
        await setLangTheme(lang, theme);
        const dir = `${EVIDENCE}/${lang}-${theme}`;
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(path);
          await expect(page.locator('tbody tr').first()).toBeVisible();
          await page.waitForTimeout(250);
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${name}-${width}.png` });
        }
      }
    }
  }

  test('measurements — content width / entity column / name gap / sidebar', async () => {
    const results: Record<string, unknown> = {};

    // ── content width list + detail at 1440/1920, sidebar open vs collapsed ──
    await page.setViewportSize({ width: 1440, height: 900 });
    const measurements: Record<string, { open: number; collapsed: number }> = {};

    for (const [path, name] of [
      ['/dashboard/categories', 'list.categories'],
      ['/dashboard/categories/coffee', 'detail.categories'],
      ['/dashboard/origins', 'list.origins'],
      ['/dashboard/origins/ethiopia', 'detail.origins'],
    ] as Array<[string, string]>) {
      await page.goto(path);
      await expect(page.locator('tbody tr').first()).toBeVisible();
      await page.waitForTimeout(250);
      const open = await contentWidth();

      // Collapse the sidebar via its toggle (case differs across locales).
      await page.getByRole('button', { name: /toggle sidebar|إظهار\/إخفاء القائمة/i }).click();
      await page.waitForTimeout(450);
      const collapsed = await contentWidth();
      await page.getByRole('button', { name: /toggle sidebar|إظهار\/إخفاء القائمة/i }).click();
      await page.waitForTimeout(450);
      measurements[name] = { open, collapsed };
    }

    // 1920 viewport.
    await page.setViewportSize({ width: 1920, height: 900 });
    for (const [path, name] of [
      ['/dashboard/categories', 'list.categories'],
      ['/dashboard/categories/coffee', 'detail.categories'],
      ['/dashboard/origins', 'list.origins'],
    ] as Array<[string, string]>) {
      await page.goto(path);
      await expect(page.locator('tbody tr').first()).toBeVisible();
      await page.waitForTimeout(250);
      measurements[`${name}@1920`] = { open: await contentWidth(), collapsed: -1 };
    }
    results.contentWidth = measurements;

    // ── entity (name) column width — the unsized flex column ──
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/origins');
    await expect(page.locator('tbody [data-testid="name-link"]').first()).toBeVisible();
    const entityCol = await page.evaluate(() => {
      const cell = document
        .querySelector('tbody [data-testid="name-link"]')
        ?.closest('td');
      return cell ? Math.round(cell.getBoundingClientRect().width) : -1;
    });
    results.entityColumnWidthAt1440 = entityCol;

    // ── gap between the first and second name columns (en + ar) ──
    // The catalog lists render name_en and name_ar side by side; only the
    // UI-language one is a link now, so measure the TEXT edges (bdi/span)
    // between the two cells — the user-visible gap.
    const measureTextGap = async (): Promise<number> => {
      return page.evaluate(() => {
        const row = document.querySelector('tbody tr');
        if (!row) return -1;
        const tds = Array.from(row.querySelectorAll('td'));
        const idx = tds.findIndex((td) => td.querySelector('[data-testid="name-link"]'));
        if (idx < 0 || idx + 1 >= tds.length) return -1;
        const a = tds[idx].querySelector('bdi, [data-testid="name-link"]');
        const b = tds[idx + 1].querySelector('bdi, span');
        if (!a || !b) return -1;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const [l, r] = ra.left < rb.left ? [ra, rb] : [rb, ra];
        return Math.round(r.left - l.right);
      });
    };
    const gap = await measureTextGap();

    // AR UI (dir=rtl) — the same two columns, same text gap.
    await setLangTheme('ar', 'light');
    await page.goto('/dashboard/origins');
    await expect(page.locator('tbody [data-testid="name-link"]').first()).toBeVisible();
    const gapAr = await measureTextGap();
    results.nameColumnGap = { en: gap, ar: gapAr };

    // ── the actual W4 target: categories list "first name → second name" gap ──
    // Row layout: main cell (current-UI-language name) + other-name column
    // (the adjacent td's text). Both languages, same row.
    const measureCategoriesGap = async (): Promise<Record<string, unknown>> => {
      return page.evaluate(() => {
        const row = document.querySelector('tbody tr');
        if (!row) return -1;
        const tds = Array.from(row.querySelectorAll('td'));
        const idx = tds.findIndex((td) => td.querySelector('[data-testid="name-link"]'));
        if (idx < 0 || idx + 1 >= tds.length) return -1;
        const a = tds[idx].querySelector('[data-testid="name-link"], [data-testid="slug-text"]');
        const b = tds[idx + 1].querySelector('bdi, span');
        if (!a || !b) return -1;
        // TEXT edges (not the truncating block element).
        const ta = tds[idx].querySelector('bdi');
        const tb = tds[idx + 1].querySelector('bdi');
        if (!ta || !tb) return -1;
        const ra = ta.getBoundingClientRect();
        const rb = tb.getBoundingClientRect();
        const [l, r] = ra.left < rb.left ? [ra, rb] : [rb, ra];
        return { textGap: Math.round(r.left - l.right), firstText: (ta as HTMLElement).innerText, secondText: (tb as HTMLElement).innerText };
      });
    };
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/categories');
    await expect(page.locator('tbody [data-testid="name-link"]').first()).toBeVisible();
    const catGapEn = await measureCategoriesGap();
    await setLangTheme('ar', 'light');
    await page.goto('/dashboard/categories');
    await expect(page.locator('tbody [data-testid="name-link"]').first()).toBeVisible();
    const catGapAr = await measureCategoriesGap();
    results.categoriesFirstSecondNameGap = { en: catGapEn, ar: catGapAr };

    // ── centering: the capped content must sit symmetric INSIDE <main> ──
    // (Not the viewport: the sidebar eats one side, and in RTL the main edge
    // moves, so margins are measured within main itself.)
    const measureCentering = async (): Promise<Record<string, unknown>> => {
      return page.evaluate(() => {
        const main = document.querySelector('main');
        const el = document.querySelector('main [class*="max-w-[1440px]"]');
        if (!main || !el) return null;
        const rm = main.getBoundingClientRect();
        const rr = el.getBoundingClientRect();
        const lm = Math.round(rr.left - rm.left);
        const rmgn = Math.round(rm.right - rr.right);
        return {
          contentWidth: Math.round(rr.width),
          leftMarginWithinMain: lm,
          rightMarginWithinMain: rmgn,
          centered: lm >= 0 && Math.abs(lm - rmgn) <= 2,
        };
      });
    };
    await page.setViewportSize({ width: 1920, height: 900 });
    await page.goto('/dashboard/categories');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    results.centeringAt1920En = await measureCentering();

    await setLangTheme('ar', 'light');
    await page.goto('/dashboard/categories');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    results.centeringAt1920Ar = await measureCentering();

    fs.writeFileSync(`${EVIDENCE}/measurements.json`, JSON.stringify(results, null, 2));
    console.log('MEASUREMENTS>>>', JSON.stringify(results, null, 1));
  });

  test('screenshots — categories list + detail, EN/AR × light/dark × 4 widths', async () => {
    await capture('/dashboard/categories', 'categories-list');
    await capture('/dashboard/categories/coffee', 'category-detail');
    await capture('/dashboard/origins', 'origins-list');
  });

  test('results.json — narrative', async () => {
    const results = {
      ticket: 'W4',
      generatedAt: new Date().toISOString(),
      change: [
        'All 9 remaining list pages (origins, farms, roast-level, processing-method, coffee-variety, tasting-note, brewing-method, pairing, products) got the centered content cap: max-w-[1440px] mx-auto w-full — categories already had it.',
        'Detail pages keep their designed caps (max-w-7xl = 1280px for catalog detail pages — inside the 1280–1440 target; product wizard / promo-code / user detail are narrow FORM pages at max-w-4xl by design, unchanged).',
      ],
      userObservation: 'user measured content ~1515px @1440 and ~1655px @1920 — that predates the caps; see measurements.json for the current numbers.',
      measurements: 'evidence/W4/measurements.json',
      screenshots: 'evidence/W4/{en,ar}-{light,dark}/{categories-list,category-detail,origins-list}-{width}.png',
    };
    fs.writeFileSync(`${EVIDENCE}/results.json`, JSON.stringify(results, null, 2));
    console.log('written');
  });
});
