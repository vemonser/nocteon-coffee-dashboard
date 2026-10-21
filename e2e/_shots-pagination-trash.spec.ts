import { expect, test } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';

/** Evidence screenshots for the trash-tab pager fix + size persistence — evidence/pagination/. */

const TRASH_TOTAL = 47;

(async () => {
  for (const lang of ['en', 'ar'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`trash shot ${lang} ${theme}`, async ({ browser }) => {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
            body: JSON.stringify({
              success: true,
              message: null,
              errors: null,
              data: {
                content: [],
                page: p,
                size: s,
                totalElements: 0,
                totalPages: 1,
                first: true,
                last: true,
              },
            }),
          });
        });

        await page.route(/\/api\/dashboard\/categories\/deleted(\?|$)/, async (route) => {
          if (route.request().method() !== 'GET') return route.fallback();
          const url = new URL(route.request().url());
          const p = Number(url.searchParams.get('page') ?? '0');
          const s = Number(url.searchParams.get('size') ?? '20');
          const start = p * s;
          const count = Math.min(s, TRASH_TOTAL - start);
          const content = Array.from({ length: Math.max(count, 0) }, (_, i) => ({
            id: 90_000 + start + i + 1,
            slug: `mock-del-${start + i + 1}`,
            description: null,
            imageUrl: null,
            isActive: false,
            createdAt: '2026-01-01T00:00:00Z',
            deletedAt: '2026-02-01T00:00:00Z',
            translations: [
              { language: 'en', name: `Deleted cat ${start + i + 1}`, description: null },
              { language: 'ar', name: `فئة محذوفة ${start + i + 1}`, description: null },
            ],
          }));
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: null,
              errors: null,
              data: {
                content,
                page: p,
                size: s,
                totalElements: TRASH_TOTAL,
                totalPages: Math.ceil(TRASH_TOTAL / s),
                first: p === 0,
                last: p >= Math.ceil(TRASH_TOTAL / s) - 1,
              },
            }),
          });
        });

        await page.goto('/dashboard/categories?view=trash');
        await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('app-pager')).toBeVisible();

        // exercise the fix: size select inside trash actually re-requests /deleted with size=10
        await page.locator('app-pager select').selectOption('10');
        await expect(page.locator('app-pager [aria-current="page"]')).toHaveText('1');
        await page.waitForTimeout(500);

        // jump to page 4 so the strip shows a sliding window: 1 2 3 4 5 (47@10 → 5 pages)
        await page
          .locator('app-pager')
          .getByRole('button', { name: lang === 'ar' ? 'صفحة 4' : 'Page 4', exact: true })
          .click();
        await expect(page.locator('app-pager [aria-current="page"]')).toHaveText('4');
        await page.waitForTimeout(400);

        await page.screenshot({
          path: `evidence/pagination/pager-trash-page4-size10-${lang}-${theme}-1440.png`,
          fullPage: false,
        });
        await page.close();
      });
    }
  }
})();
