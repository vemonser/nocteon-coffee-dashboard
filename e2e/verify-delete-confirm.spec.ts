import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * Delete-confirmation contract:
 *
 *  AC-D1 — the list's delete button opens a confirm modal first; nothing is
 *          sent to the API until the user confirms.
 *  AC-D2 — when the backend refuses (a category still linked to products →
 *          409 "still used elsewhere"), the row stays and the toast carries
 *          the backend's own reason — never a generic "please try again".
 *  AC-D3 — permanent delete no longer asks for the slug: a plain destructive
 *          confirm ("this cannot be undone") and a delete button.
 *
 * Everything here is non-destructive by construction: the only entity the
 * tests confirm-delete is "coffee", which is product-linked on the backend —
 * the server answers 409 and nothing moves.
 */

const DESKTOP = { width: 1440, height: 900 };

/** The seeded category that definitely still has products (backend-refused delete). */
const REFERENCED_CATEGORY = 'coffee';

test.describe('Delete confirmations', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: DESKTOP });
    page = await context.newPage();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      if (result.status === 429) {
        await page.waitForTimeout(20_000);
        continue;
      }
      expect(result.role, 'the delete-confirm suite requires an ADMIN account').toBe('ADMIN');
      return;
    }
    throw new Error('login stayed rate-limited (429) after 3 attempts');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-D1 + AC-D2: confirm modal first; backend 409 lands in the toast, row stays', async () => {
    const deleteRequests: string[] = [];
    page.on('request', (req) => {
      if (
        req.method() === 'DELETE' &&
        req.url().includes('/api/dashboard/categories/') &&
        !req.url().endsWith('/permanent')
      ) {
        deleteRequests.push(req.url());
      }
    });

    await page.goto('/dashboard/categories');
    await expect(page.locator('table')).toBeVisible();

    // Row carrying the referenced category.
    const row = page
      .locator('tbody tr')
      .filter({ hasText: /Coffee|القهوة/ })
      .first();
    await expect(row).toBeVisible();

    // Open the confirm dialog — via the row's delete action (aria-labelled).
    await row.getByRole('button', { name: /^(Move to trash|نقل إلى الم)/ }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog, 'no confirm modal appeared before the delete').toBeVisible();
    await expect(
      dialog.getByRole('button', { name: /^(Move to trash|نقل إلى الم)/ }),
    ).toBeVisible();

    // Nothing may have been sent while the dialog was open.
    expect(deleteRequests, 'a DELETE went out before confirmation').toEqual([]);

    await dialog.getByRole('button', { name: /^(Move to trash|نقل إلى الم)/ }).click();

    // The backend refuses (409, still referenced) — the toast shows THAT reason.
    await expect(
      page.getByText(/used elsewhere|ما زال مستخدم/).first(),
      'the toast did not carry the backend 409 reason',
    ).toBeVisible();

    // …and the row survives (nothing was trashed).
    await page.waitForTimeout(500);
    expect(
      deleteRequests.some((url) => url.includes(`/${REFERENCED_CATEGORY}`)),
      'the referenced category DELETE never reached the API',
    ).toBe(true);
    await expect(page.locator('table')).toBeVisible();
    await expect(
      page.locator('tbody tr', { hasText: /Coffee|القهوة/ }).first(),
      'the backend-refused row disappeared',
    ).toBeVisible();
  });

  test('AC-D3: permanent delete is a plain confirm, not a slug-typing dialog', async () => {
    await page.goto('/dashboard/categories?view=trash');
    await expect(page.locator('table')).toBeVisible();

    // Trash view: the permanent delete is a direct destructive button.
    await page
      .locator('tbody tr')
      .first()
      .getByRole('button', { name: /permanently|نهائي/i })
      .click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    // No typing anywhere: there is no text input in the dialog.
    await expect(dialog.locator('input'), 'the confirm dialog still asks for typing').toHaveCount(0);
    await expect(
      dialog.getByRole('button', { name: /delete permanently|حذف نهائي/i }),
      'the confirm button is missing',
    ).toBeVisible();
    await expect(dialog.getByText(/cannot be undone|لا يمكن التراجع/)).toBeVisible();

    // Cancel — do not actually destroy the seeded trash row.
    await dialog.getByRole('button', { name: /^Cancel$|^إلغاء$/ }).click();
    await expect(dialog).toHaveCount(0);
  });
});
