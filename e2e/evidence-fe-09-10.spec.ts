import { test, expect, type Page } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';

/**
 * Evidence for FE-09 (variant images) and FE-10 (product tags).
 *
 * These prove the two flows the backlog names, in a real browser at the 1440x900 viewport the
 * repository's screenshots use: a tag is created on its page, assigned in the wizard, and the
 * products list filters by it; a variant accepts its own photo and shows the thumbnail.
 */
const VIEWPORT = { width: 1440, height: 900 };

/**
 * Open the wizard and get past the autosave prompt.
 *
 * Every reload after a save finds a draft: the response never returns here (the post-commit AI
 * reindex has no quota), so the wizard never marks the form saved. Discarding the draft is what
 * an admin would do; the write already landed, which is what the assertions read back.
 */
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

/**
 * Click Save and come back with a fresh load.
 *
 * The save is not awaited: the product write commits, but the response only returns after the
 * post-commit AI reindex, which has no embedding quota in this environment and hangs. Reloading
 * and reading the field back proves the write landed — which is the property under test anyway.
 */
async function saveAndReload(page: Page, url: string): Promise<void> {
  await page.getByRole('button', { name: /Save changes|حفظ التغييرات/ }).first().click();
  await page.waitForTimeout(4_000);
  await gotoProduct(page, url);
}

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

test.describe('FE-10 product tags', () => {
  test('create a tag, assign it in the wizard, filter, refuse deleting it in use', async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(VIEWPORT);
    await login(page);

    const suffix = Date.now().toString(36).slice(-5);
    const nameEn = `Evidence ${suffix}`;
    const slug = `evidence-${suffix}`;
    const productUrl = '/dashboard/products/brazil-mogiana/edit';

    // ── 1. The tags page creates a tag ───────────────────────────────────────
    await page.goto('/dashboard/product-tags');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /Add tag|إضافة وسم/ }).first().click();
    const dialog = page.locator('[data-testid="product-tag-editor"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('#tag-name-en').fill(nameEn);
    await dialog.locator('#tag-name-ar').fill(`وسم ${suffix}`);
    await dialog.getByRole('button', { name: /Add tag|إضافة وسم/ }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    const card = page.locator('.card-surface', { hasText: `/${slug}` });
    await expect(card).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'evidence/fe-10/tags-1440.png' });

    // ── 2. The wizard assigns it to a product and saves ──────────────────────
    await gotoProduct(page, `${productUrl}?step=basic`);
    const tagChip = page.getByRole('button', { name: new RegExp(nameEn) });
    await expect(tagChip).toBeVisible({ timeout: 30_000 });
    await expect(tagChip).toHaveAttribute('aria-pressed', 'false');
    await tagChip.click();
    await expect(tagChip).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: 'evidence/fe-10/wizard-tags-1440.png' });

    // Reopen the product: the assignment round-trips through edit mode.
    await saveAndReload(page, `${productUrl}?step=basic`);
    await expect(page.getByRole('button', { name: new RegExp(nameEn) }))
      .toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 });

    // ── 3. The products list filters by it (the filter lives in the URL) ─────
    await page.goto('/dashboard/products');
    // Filter row order: type, tag, status, featured.
    await page.locator('hlm-select-trigger').nth(1).click();
    await page.getByRole('option', { name: nameEn }).click();
    await expect(page).toHaveURL(new RegExp(`tag=${slug}`), { timeout: 20_000 });
    await expect(page.getByText('Brazil Mogiana').first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'evidence/fe-10/products-tag-filter-1440.png' });

    // The filter is read back from the URL, not only written to it: a reload keeps it applied.
    await page.reload();
    await expect(page.locator('hlm-select-trigger').nth(1)).toContainText(nameEn, { timeout: 20_000 });
    await expect(page.getByText('Brazil Mogiana').first()).toBeVisible();

    // ── 4. Deleting a tag a product carries is refused, with the count ───────
    await page.goto('/dashboard/product-tags');
    const usedCard = page.locator('.card-surface', { hasText: `/${slug}` });
    await usedCard.getByRole('button', { name: /actions|إجراءات/i }).click();
    await page.getByRole('menuitem', { name: /delete|حذف/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^(Delete|حذف)$/ }).click();
    await expect(page.getByText(/used by 1 product/i)).toBeVisible({ timeout: 20_000 });

    // ── 5. Cleanup: detach the tag, then the delete succeeds ─────────────────
    await gotoProduct(page, `${productUrl}?step=basic`);
    const attachedChip = page.getByRole('button', { name: new RegExp(nameEn) });
    await expect(attachedChip).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 });
    await attachedChip.click();
    await saveAndReload(page, `${productUrl}?step=basic`);
    await expect(page.getByRole('button', { name: new RegExp(nameEn) }))
      .toHaveAttribute('aria-pressed', 'false', { timeout: 30_000 });

    await page.goto('/dashboard/product-tags');
    const freeCard = page.locator('.card-surface', { hasText: `/${slug}` });
    await freeCard.getByRole('button', { name: /actions|إجراءات/i }).click();
    await page.getByRole('menuitem', { name: /delete|حذف/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^(Delete|حذف)$/ }).click();
    await expect(page.locator('.card-surface', { hasText: `/${slug}` })).toHaveCount(0, { timeout: 20_000 });
  });
});

test.describe('FE-09 variant images', () => {
  test('a variant accepts its own photo and shows the thumbnail', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(VIEWPORT);
    await login(page);

    await page.goto('/dashboard/products/brazil-mogiana/edit?step=variants');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });

    // The first variant card is expanded; upload into it.
    const upload = page.getByRole('button', { name: /Upload image|رفع صورة/ }).first();
    await expect(upload).toBeVisible({ timeout: 20_000 });

    const chooser = page.waitForEvent('filechooser');
    await upload.click();
    const fileChooser = await chooser;
    // A real 256x256 PNG: Cloudinary rejects a corrupt or 0-byte file with
    // "Failed to ping image", so the fixture is generated rather than inlined.
    await fileChooser.setFiles('/tmp/opencode/variant.png');

    // The tile renders the uploaded picture once the API answers. "Visible" is not enough for
    // an <img>: it can be laid out while broken, so the assertion is that it actually decoded.
    const tile = page.locator('img[src*="cloudinary"]').first();
    await expect(tile).toBeVisible({ timeout: 45_000 });
    await expect
      .poll(() => tile.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), {
        timeout: 45_000,
      })
      .toBe(true);
    await page.screenshot({ path: 'evidence/fe-09/variant-image-1440.png' });
  });
});
