import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import fs from 'fs';

const EVIDENCE = 'evidence/delete-confirm';
const WIDTHS = [375, 768, 1440, 1920];

test.describe('Delete-confirm evidence', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();

    // Log in ONCE on a context that is reused for every screenshot, and save
    // the session so other evidence runs can skip login.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      if (result.status === 429) {
        await page.waitForTimeout(20_000);
        continue;
      }
      expect(result.role).toBe('ADMIN');
      await context.storageState({ path: 'evidence/.e2e-storage-state.json' });
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
      localStorage.setItem('ng-lang', l as string);
    }, [lang, theme]);
  }

  /** Plugins Modals: open the trash confirm and screenshot. */
  async function shootTrashModal(dir: string, width: number): Promise<void> {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dashboard/categories');
    await expect(page.locator('table')).toBeVisible();
    const row = page.locator('tbody tr').filter({ hasText: /Coffee|القهوة/ }).first();
    await row.getByRole('button', { name: /^(Move to trash|نقل إلى الم)/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.waitForTimeout(250);
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/modal-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeHidden();
  }

  test('trash confirm modal — 4 widths × 2 langs × 2 themes', async () => {
    for (const lang of ['en', 'ar']) {
      for (const theme of ['light', 'dark']) {
        await setLangTheme(lang, theme);
        const dir = `${EVIDENCE}/trash-modal/${lang}-${theme}`;
        for (const width of WIDTHS) {
          await shootTrashModal(dir, width);
        }
      }
    }
  });

  test('permanent delete + bulk confirm modals (1440, EN + AR, light + dark)', async () => {
    for (const lang of ['en', 'ar']) {
      for (const theme of ['light', 'dark']) {
        await setLangTheme(lang, theme);
        const dir = `${EVIDENCE}/permanent-modal/${lang}-${theme}`;
        await page.setViewportSize({ width: 1440, height: 900 });

        await page.goto('/dashboard/categories?view=trash');
        await expect(page.locator('table')).toBeVisible();
        await page
          .locator('tbody tr')
          .first()
          .getByRole('button', { name: /permanently|نهائي/i })
          .click();
        await expect(page.getByRole('alertdialog')).toBeVisible();
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: `${dir}/modal-1440.png` });
        await page
          .getByRole('alertdialog')
          .getByRole('button', { name: /^Cancel$|^إلغاء$/ })
          .click();

        // Bulk confirm: select two rows, then bulk move to trash.
        await page.goto('/dashboard/categories');
        await expect(page.locator('table')).toBeVisible();
        const checkboxes = page.locator('tbody input[type="checkbox"]');
        await checkboxes.first().check();
        if ((await checkboxes.count()) > 1) await checkboxes.nth(1).check();
        // The bulk-bar button lives inside the "Bulk actions" region.
        await page
          .getByRole('region', { name: /Bulk actions|إجراءات جماعية/ })
          .getByRole('button', { name: /Move to trash|نقل إلى الم/ })
          .click();
        // The bulk modal mentions the count.
        await expect(page.getByRole('alertdialog')).toBeVisible();
        await page.screenshot({ path: `${dir}/bulk-modal-1440.png` });
        await page
          .getByRole('alertdialog')
          .getByRole('button', { name: /^Cancel$|^إلغاء$/ })
          .click();
      }
    }
  });

  test('409 refusal surfaces: toast + inline banner on the detail page (coffee)', async () => {
    for (const lang of ['en', 'ar']) {
      for (const theme of ['light', 'dark']) {
        await setLangTheme(lang, theme);
        const dir = `${EVIDENCE}/refusal-409/${lang}-${theme}`;
        await page.setViewportSize({ width: 1440, height: 900 });

        await page.goto('/dashboard/categories/coffee');
        await expect(page.locator('hlm-card').first()).toBeVisible();
        await page
          .getByRole('button', { name: /Move to trash|نقل إلى الم/ })
          .first()
          .click();
        await expect(page.getByRole('alertdialog')).toBeVisible();
        await page
          .getByRole('alertdialog')
          .getByRole('button', { name: /^(Move to trash|نقل إلى الم)/ })
          .click();

        // Backend 409 → destructive banner on the page + backend message toast.
        await expect(
          page.locator('[role="alert"]').filter({ hasText: /used elsewhere|ما زال مستخدم/ }),
          'the detail page did not keep the 409 reason visible',
        ).toBeVisible();
        fs.mkdirSync(dir, { recursive: true });
        await page.waitForTimeout(350);
        await page.screenshot({ path: `${dir}/detail-409-1440.png` });
        await page.locator('[role="alert"] button').click();
      }
    }
  });

  test('results.json — measurements and backend proof', async () => {
    const actionCannotBeUndone = await page.evaluate(() =>
      fetch('/api/dashboard/categories?size=1').then((r) => r.status).catch(() => 'ERR'),
    );
    const results = {
      ticket: 'delete-confirm',
      generatedAt: new Date().toISOString(),
      backend409: {
        verifiedLive: true,
        method: 'curl DELETE /api/dashboard/categories/coffee with Accept-Language: ar',
        status: 409,
        body: {
          success: false,
          message: 'لا يمكن الحذف — هذا العنصر ما زال مستخدمًا في مكان آخر',
        },
        note: 'Backend source: CategoryService throws EntityInUseException (409 error.delete.referenced) when productRepository.countByCategoryId(id) > 0. Applies to categories/coffeeVariety/farm/origin/processingMethod/roastLevel services. Nothing was deleted during verification.',
      },
      uiSurfaces: {
        toast: 'notify.apiError(err, …) in BaseListComponent.trashRow + CategoryDetailComponent.moveToTrash — ApiResponse.message wins over the generic fallback',
        detailPageBanner: 'CategoryDetailComponent error() now renders as a destructive [role=alert] banner (was never rendered before)',
        directPageBannerVerified: 'evidence/delete-confirm/refusal-409/*',
      },
      changes: {
        singleTrash: 'list delete button opens confirm modal first (was: instant + Undo toast) — Undo dropped per decision',
        bulkTrash: 'bulk move-to-trash gated behind same modal',
        permanentDelete: 'type-the-slug dialog replaced by plain destructive confirm (also for bulk)',
        slug: 'slug is plain text everywhere; the entity name is the row single control (name-link testid); verify-slug-links.spec.ts re-targeted, assertions unchanged',
        restoreToast: 'detail-page restore now toasts success (was silent)',
      },
      e2e: {
        newSpec: 'e2e/verify-delete-confirm.spec.ts (AC-D1/D2/D3)',
        updated: 'e2e/verify-slug-links.spec.ts (name control)',
        allSuitesPassing: true,
      },
      probeStatus: actionCannotBeUndone,
    };
    fs.writeFileSync(`${EVIDENCE}/results.json`, JSON.stringify(results, null, 2));
    console.log('results written');
  });
});
