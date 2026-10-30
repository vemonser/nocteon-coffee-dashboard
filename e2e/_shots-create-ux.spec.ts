import { expect, test, type Page } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';
import { cleanupCreated, recordResponse, slugify, testName } from './helpers/test-data';

/** Evidence screenshots for the create-category UX ticket — evidence/create-ux/. */

(async () => {
  for (const lang of ['en', 'ar'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      for (const state of ['empty', 'duplicate', 'backend400', 'happy'] as const) {
        test(`shot ${state} ${lang} ${theme}`, async ({ browser }) => {
          const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
          await page.addInitScript(([l, th]: [string, string]) => {
            localStorage.setItem('language', l);
            localStorage.setItem('nocteon-theme', th);
          }, [lang, theme] as unknown as Parameters<typeof page.addInitScript>[1]);

          await gotoLogin(page);
          await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
          await submitLogin(page);
          await page.goto('/dashboard/categories');
          await expect(page.locator('table tbody tr').first()).toBeVisible();

          const dialog = () => page.getByRole('dialog');
          const nameInputs = () => dialog().getByLabel(/Name|الاسم/);
          const save = () => dialog().getByRole('button', { name: /Create category|إنشاء فئة/ });

          const open = async () => {
            await page
              .getByRole('button', { name: /Add category|إضافة فئة/ })
              .click();
            await expect(dialog()).toBeVisible();
          };
          const stamp = Date.now();
          const unique = testName(`shot ${lang} ${stamp}`);
          const slug = slugify(unique);
          let createdSlug: string | null = null;

          if (state === 'empty' || state === 'duplicate') {
            await open();
            if (state === 'duplicate') {
              await nameInputs().nth(0).fill('Coffee');
              await nameInputs().nth(1).fill('فئة فريدة تجريبية');
            }
            await save().click();
            await page.waitForTimeout(700);
          }

          if (state === 'backend400') {
            await page.route(
              (url) => url.pathname.endsWith('/api/dashboard/categories'),
              async (route) => {
                if (route.request().method() !== 'POST') return route.fallback();
                await route.fulfill({
                  status: 400,
                  contentType: 'application/json',
                  body: JSON.stringify({
                    success: false,
                    message: 'Slug already exists on server',
                    data: null,
                    errors: null,
                  }),
                });
              },
            );
            await open();
            await nameInputs().nth(0).fill(unique);
            await nameInputs().nth(1).fill('فئة مرفوضة تجريبية');
            await save().click();
            await page.waitForTimeout(1000);
            await page.unroute((url) => url.pathname.endsWith('/api/dashboard/categories'));
          }

          if (state === 'happy') {
            await open();
            await nameInputs().nth(0).fill(unique);
            await nameInputs().nth(1).fill(`فئة إنشاء تجريبية`);
            const createdResponse = page.waitForResponse(
              (r) =>
                r.url().includes('/api/dashboard/categories') &&
                r.request().method() === 'POST',
            );
            await save().click();
            await recordResponse(await createdResponse, 'categories', unique);
            await page.waitForURL(/\/dashboard\/categories\//, { timeout: 15000 });
            createdSlug = slug;
            await page.waitForTimeout(1200); // detail page settle
          }

          await page.waitForTimeout(300);
          await page.screenshot({
            path: `evidence/create-ux/create-${state}-${lang}-${theme}-1440.png`,
            fullPage: false,
          });

          // cleanup any created entity
          if (createdSlug) {
            await page.goto('/dashboard/categories');
            await expect(page.locator('table tbody tr').first()).toBeVisible();
            const row = page.locator('tbody tr').filter({ hasText: createdSlug });
            if (await row.count()) {
              await row
                .first()
                .getByRole('button', { name: /Move to trash|نقل إلى المهملات/ })
                .click();
              await expect(row).toHaveCount(0, { timeout: 8000 });
            }
          }
          await page.close();
        });
      }
    }
  }

  // Permanently remove every category this run created (the UI only trashes).
  test.afterAll(async () => {
    await cleanupCreated();
  });
})();
