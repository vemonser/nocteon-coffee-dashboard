import { test, expect, type Page } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';

/**
 * Evidence for FE-11 (related products) and FE-12 (duplicate product).
 *
 * Same environment note as the FE-09/FE-10 spec: a product save commits but its response never
 * returns (the post-commit AI reindex has no embedding quota here), so the wizard is always
 * reopened with a fresh load and the autosave prompt dismissed.
 */
const VIEWPORT = { width: 1440, height: 900 };
const PRODUCT_URL = '/dashboard/products/brazil-mogiana/edit';

async function login(page: Page) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await gotoLogin(page);
    await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
    const result = await submitLogin(page);
    if (result.status === 429) {
      await page.waitForTimeout(20_000);
      continue;
    }
    if (!page.url().includes('/login')) return;
  }
  throw new Error('login did not land');
}

async function gotoProduct(page: Page, url: string): Promise<void> {
  await page.goto(url);
  const discard = page.getByRole('button', { name: /Discard draft|تجاهل المسودة/ });
  try {
    await discard.waitFor({ state: 'visible', timeout: 5_000 });
    await discard.click();
  } catch {
    // No draft: the normal case on a first visit.
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
}

async function saveAndReload(page: Page, url: string): Promise<void> {
  await page.getByRole('button', { name: /Save changes|حفظ التغييرات/ }).first().click();
  await page.waitForTimeout(4_000);
  await gotoProduct(page, url);
}

test.describe('FE-11 related products', () => {
  test('pick two products, save, reopen, then clear', async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(VIEWPORT);
    await login(page);

    const relatedUrl = `${PRODUCT_URL}?step=pairings`;

    // ── 1. Search the catalogue and add two products ─────────────────────────
    await gotoProduct(page, relatedUrl);
    const search = page.getByRole('searchbox', { name: /Search products|ابحث عن منتج/ });
    await expect(search).toBeVisible({ timeout: 30_000 });

    for (const term of ['kenya', 'ethiopia']) {
      await search.fill(term);
      const add = page.getByRole('button', { name: /^Add$|^إضافة$/ }).first();
      await expect(add).toBeVisible({ timeout: 20_000 });
      await add.click();
    }

    const chips = page.locator('ul[aria-label] > li');
    await expect(chips).toHaveCount(2, { timeout: 20_000 });
    await expect(page.getByText('2 of 6')).toBeVisible();
    await page.screenshot({ path: 'evidence/fe-11/related-picker-1440.png' });

    // ── 2. The choice survives a save and a reload ───────────────────────────
    await saveAndReload(page, relatedUrl);
    await expect(page.getByText('2 of 6')).toBeVisible({ timeout: 30_000 });

    // ── 3. Cleanup: clear the list and save again ────────────────────────────
    for (let i = 0; i < 2; i += 1) {
      await page.locator('ul[aria-label] > li button').first().click();
    }
    await expect(page.getByText('0 of 6')).toBeVisible({ timeout: 20_000 });
    await saveAndReload(page, relatedUrl);
    await expect(page.getByText('0 of 6')).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('FE-12 duplicate product', () => {
  test('the row action copies the product and opens the copy', async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(VIEWPORT);
    await login(page);

    await page.goto('/dashboard/products');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });

    // The exact seeded row: "Brazil Mogiana (copy)" would also match /Brazil Mogiana/, and the
    // list is newest-first, so an earlier copy would be the first match.
    const row = page
      .getByRole('row')
      .filter({ has: page.getByText('brazil-mogiana', { exact: true }) })
      .first();
    await row.getByRole('button', { name: /actions|إجراءات/i }).click();
    await page.getByRole('menuitem', { name: /Duplicate|نسخ/ }).click();

    // The API answers with the copy, and the wizard opens on it.
    await expect(page).toHaveURL(/\/dashboard\/products\/brazil-mogiana-copy(-\d+)?\/edit/, {
      timeout: 60_000,
    });
    // The slug is rendered inside the read-only field, not as text.
    await expect(page.locator('input[readonly]').first()).toHaveValue(/brazil-mogiana-copy/, {
      timeout: 30_000,
    });
    // And the copy starts disabled, so it cannot reach the storefront unedited.
    await expect(page.getByText(/^(Disabled|معطّل)$/).first()).toBeVisible();
    await page.screenshot({ path: 'evidence/fe-12/duplicate-copy-1440.png' });

    // ── Cleanup: this run's copy is trashed and then deleted for good ────────
    // The trash view exposes restore/permanent-delete icon buttons instead of the row menu, and
    // the table renders after the heading — so each step waits for its row, not the page.
    const copySlug = new URL(page.url()).pathname.split('/')[3];
    const rowFor = (slug: string) => page.getByRole('row').filter({ hasText: slug }).first();

    await page.goto('/dashboard/products');
    await rowFor(copySlug).waitFor({ state: 'visible', timeout: 30_000 });
    await rowFor(copySlug).getByRole('button', { name: /actions|إجراءات/i }).click();
    await page.getByRole('menuitem', { name: /Move to trash|نقل إلى سلة المحذوفات/i }).click();

    await page.goto('/dashboard/products?view=trash');
    await rowFor(copySlug).waitFor({ state: 'visible', timeout: 30_000 });
    await rowFor(copySlug).getByRole('button', { name: /Delete permanently|حذف نهائي/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^(Delete|حذف)$/ }).click();
    await expect(rowFor(copySlug)).toHaveCount(0, { timeout: 30_000 });
  });
});
