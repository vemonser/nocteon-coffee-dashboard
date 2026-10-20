import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * Phase 2, ticket 2.1 — language reactivity on the dashboard.
 *
 * The QA report found, in the ENGLISH UI:
 *   - Arabic category / origin / roast-level names
 *   - the Arabic "الإجمالي" donut-centre label
 *   - Arabic product names in Top selling
 *   - Arabic month names on the chart axis
 *   - the raw key "orders.statuses.DELIVERED" in the status legend
 *
 * This test switches the language AT RUNTIME (through the app's own user
 * menu) and asserts the whole page in each state. It also asserts that no
 * string matching a raw translation key appears anywhere on the page.
 *
 * It runs for every cell of the matrix: en/ar x light/dark, at 375, 768,
 * 1024, 1440 and 1920 — the language bug is not a viewport bug, but the
 * acceptance criterion is "the e2e test passes in all cells", so it is
 * checked in all of them.
 */

/** A raw translation key: `orders.statuses.DELIVERED`. */
const RAW_KEY = /\b[a-z]+\.[a-z]+\.[A-Z_]+\b/;

/** Any Arabic-script run. */
const ARABIC = /[؀-ۿ]/;

const WIDTHS = [375, 768, 1024, 1440, 1920];
const THEMES = ['light', 'dark'] as const;
const LANGS = ['en', 'ar'] as const;

/** Set the theme without reloading (the theme is a boot-time concern). */
async function setTheme(page: Page, theme: string) {
  await page.evaluate((t) => localStorage.setItem('nocteon-theme', t), theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
}

/** Switch the language through the app's own control (user menu). */
async function switchLanguage(page: Page, target: 'en' | 'ar') {
  const current = await page.evaluate(() => document.documentElement.lang);
  if (current === target) return;

  const trigger = page.locator(
    'app-user-menu[variant="navbar"] button[data-slot="dropdown-menu-trigger"]',
  );
  await trigger.waitFor({ state: 'visible', timeout: 15_000 });
  await trigger.click();
  const item = page.locator('[role="menuitem"]', { hasText: /Language|اللغة/ });
  await item.waitFor({ state: 'visible', timeout: 10_000 });
  await item.click();

  await page.waitForFunction(
    (lang) => document.documentElement.lang === lang,
    target,
    { timeout: 15_000 },
  );
  // The chart options and the entity names settle after the language flips.
  await page.waitForTimeout(2500);
}

/** Every text node on the page, joined. */
async function pageText(page: Page): Promise<string> {
  return page.locator('body').innerText();
}

/**
 * The chart legend entries.
 *
 * The chart card draws its own legend (an HTML list BELOW the chart), so the
 * legend is read from the markup, not from a charting library's internals.
 */
async function legendTexts(page: Page): Promise<string[]> {
  return (
    await page.locator('app-chart-card ul.mt-3 li, app-chart-card ul li').allTextContents()
  )
    .map((t) => t.trim())
    .filter(Boolean);
}

/** The donut-centre labels (the text inside the ring). */
async function donutLabels(page: Page): Promise<string[]> {
  return (
    await page.locator('[data-testid="donut-center-label"], [data-testid="donut-center-value"]').allTextContents()
  )
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * The chart x-axis labels.
 *
 * ApexCharts renders an axis label as a `<text>` that CONTAINS a `<tspan>`;
 * the text of the `<text>` element is empty, so the tspan has to be read.
 */
async function axisLabels(page: Page): Promise<string[]> {
  return (
    await page.locator('[data-testid="x-axis-label"]').allTextContents()
  )
    .map((t) => t.trim())
    .filter(Boolean);
}

test.describe('dashboard language reactivity', () => {
  test.setTimeout(180_000);

  // ONE context and ONE login for the whole matrix: POST /api/auth/login
  // allows 5/minute per IP and per identifier, so twenty logins in a row
  // would be rate-limited into a false failure. The session is shared; each
  // test sets the language and the theme it needs.
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      if (result.status === 429) {
        await page.waitForTimeout(20_000);
        continue;
      }
      expect(result.role, 'this suite requires an ADMIN account').toBe('ADMIN');
      return;
    }
    throw new Error('login stayed rate-limited (429) after 4 attempts');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  for (const lang of LANGS) {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        test(`${lang} / ${theme} / ${width}px — the whole page follows the language`, async () => {
          await page.setViewportSize({ width, height: 900 });
          await setTheme(page, theme);
          await page.goto('/dashboard?days=30', { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(2500);

          // ── 1. English state ──────────────────────────────────────────
          await switchLanguage(page, 'en');
          await expect(page.locator('html')).toHaveAttribute('lang', 'en');

          const enText = await pageText(page);
          expect(enText, 'no raw translation key may reach the screen').not.toMatch(RAW_KEY);
          expect(enText, 'the English UI must not contain Arabic').not.toMatch(ARABIC);

          const enLegend = await legendTexts(page);
          expect(enLegend.length, 'the charts must have a legend').toBeGreaterThan(0);
          for (const entry of enLegend) {
            expect(entry, `legend entry "${entry}" must not be a raw key`).not.toMatch(RAW_KEY);
            expect(entry, `legend entry "${entry}" must not be Arabic`).not.toMatch(ARABIC);
          }

          const enDonuts = await donutLabels(page);
          for (const label of enDonuts) {
            expect(label, `donut label "${label}" must not be Arabic`).not.toMatch(ARABIC);
          }

          const enAxis = await axisLabels(page);
          for (const label of enAxis) {
            expect(label, `axis label "${label}" must not be Arabic`).not.toMatch(ARABIC);
          }

          // The status legend must carry the translated status, not the key.
          const statusLegend = enLegend.filter((e) => /Delivered|Processing|Shipped/i.test(e));
          expect(
            statusLegend.length,
            'the status legend must show the translated status names',
          ).toBeGreaterThan(0);


          // ── 2. Arabic state ───────────────────────────────────────────
          await switchLanguage(page, 'ar');
          await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
          await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

          const arText = await pageText(page);
          expect(arText, 'no raw translation key may reach the screen').not.toMatch(RAW_KEY);
          expect(arText, 'the Arabic UI must contain Arabic').toMatch(ARABIC);

          const arLegend = await legendTexts(page);
          expect(arLegend.length).toBeGreaterThan(0);
          for (const entry of arLegend) {
            expect(entry, `legend entry "${entry}" must not be a raw key`).not.toMatch(RAW_KEY);
          }

          // The Arabic status legend must carry the TRANSLATED status, not
          // the raw enum and not the English word.
          const arStatusLegend = arLegend.filter((e) =>
            /تم التوصيل|قيد المعالجة|تم الشحن/.test(e),
          );
          expect(
            arStatusLegend.length,
            'the Arabic status legend must show the translated status names',
          ).toBeGreaterThan(0);
          expect(
            arLegend.some((e) => /^(Delivered|Processing|Shipped)$/i.test(e)),
            'the Arabic legend must not keep the English status names',
          ).toBe(false);

          const arDonuts = await donutLabels(page);
          for (const label of arDonuts) {
            expect(label, `donut label "${label}" must not be a raw key`).not.toMatch(RAW_KEY);
          }

          const arAxis = await axisLabels(page);
          expect(arAxis.length, 'the chart must have axis labels').toBeGreaterThan(0);
          for (const label of arAxis) {
            expect(label, `axis label "${label}" must not be a raw key`).not.toMatch(RAW_KEY);
          }

          // The Arabic month names: at least one axis label carries a month.
          const arabicMonths = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
          ];
          const hasArabicMonth = arAxis.some((l) =>
            arabicMonths.some((m) => l.includes(m)),
          );
          expect(
            hasArabicMonth,
            `the axis must carry Arabic month names in Arabic (got ${JSON.stringify(arAxis)})`,
          ).toBe(true);

          // ── 3. Back to English ───────────────────────────────────────
          await switchLanguage(page, 'en');
          await expect(page.locator('html')).toHaveAttribute('lang', 'en');

          const backText = await pageText(page);
          expect(backText, 'no raw translation key may reach the screen').not.toMatch(RAW_KEY);
          expect(backText, 'the English UI must not contain Arabic').not.toMatch(ARABIC);

          const backLegend = await legendTexts(page);
          for (const entry of backLegend) {
            expect(entry, `legend entry "${entry}" must not be Arabic`).not.toMatch(ARABIC);
          }
          const backDonuts = await donutLabels(page);
          for (const label of backDonuts) {
            expect(label, `donut label "${label}" must not be Arabic`).not.toMatch(ARABIC);
          }
          const backAxis = await axisLabels(page);
          for (const label of backAxis) {
            expect(label, `axis label "${label}" must not be Arabic`).not.toMatch(ARABIC);
          }
        });
      }
    }
  }
});
