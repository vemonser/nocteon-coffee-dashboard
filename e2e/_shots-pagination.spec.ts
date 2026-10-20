import { expect, test } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';

/** Evidence screenshots for numbered pagination + per-page select — evidence/pagination/. */

const TOTAL = 190;

const catResponse = (page: number, size: number) => {
  const start = page * size;
  const count = Math.min(size, TOTAL - start);
  const content = Array.from({ length: Math.max(count, 0) }, (_, i) => ({
    id: start + i + 1,
    slug: `mock-cat-${start + i + 1}`,
    description: null,
    imageUrl: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    translations: [
      { language: 'en', name: `Mocked category ${start + i + 1}`, description: null },
      { language: 'ar', name: `فئة وهمية ${start + i + 1}`, description: null },
    ],
  }));
  return {
    success: true,
    message: null,
    data: {
      content,
      page,
      size,
      totalElements: TOTAL,
      totalPages: Math.ceil(TOTAL / size),
      first: page === 0,
      last: page >= Math.ceil(TOTAL / size) - 1,
    },
    errors: null,
    timestamp: '2026-01-01T00:00:00Z',
  };
};

(async () => {
  for (const lang of ['en', 'ar'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`shot ${lang} ${theme}`, async ({ browser }) => {        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.addInitScript(([l, th]: [string, string]) => {
          localStorage.setItem('language', l);
          localStorage.setItem('nocteon-theme', th);
        }, [lang, theme] as unknown as Parameters<typeof page.addInitScript>[1]);

        await gotoLogin(page);
        await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
        await submitLogin(page);

        await page.route(/\/api\/dashboard\/categories(\?|$)/, async (route) => {
          if (route.request().method() !== 'GET') return route.fallback();
          const url = new URL(route.request().url());
          const p = Number(url.searchParams.get('page') ?? '0');
          const s = Number(url.searchParams.get('size') ?? '20');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(catResponse(p, s)),
          });
        });

        await page.goto('/dashboard/categories');
        await expect(page.locator('table tbody tr').first()).toBeVisible();
        await expect(page.locator('app-pager')).toBeVisible();

        // Click 3 → 4 → 5 so the strip eventually shows: 1 … 4 5 6 … 10
        const pageLabel = (n: number) => (lang === 'ar' ? `صفحة ${n}` : `Page ${n}`);
        const pager = page.locator('app-pager');
        for (const n of [3, 4, 5]) {
          await pager.getByRole('button', { name: pageLabel(n), exact: true }).click();
          await expect(pager.locator('[aria-current="page"]')).toHaveText(`${n}`);
        }
        await page.waitForTimeout(400);

        await page.screenshot({
          path: `evidence/pagination/pager-page5-${lang}-${theme}-1440.png`,
          fullPage: false,
        });
        await page.close();
      });
    }
  }
})();
