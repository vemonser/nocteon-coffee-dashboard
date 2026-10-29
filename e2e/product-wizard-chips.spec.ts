import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * PRODUCTS-04 — the shared chip-multiselect in the product wizard.
 *
 * The step passed the selection to the component as a `computed` over a
 * FormArray's `.value`, which is not a signal: the component kept the empty
 * first read, so a picked note never became a chip, its Add button stayed
 * enabled, and the next pick silently replaced the previous one. This test
 * holds the behaviour the step was always supposed to have — several picks
 * coexist, each shows a removable chip, and a picked row cannot be added twice.
 */
test.describe('product wizard — chip multiselect', () => {
  test.setTimeout(180_000);

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

  test('tasting notes keep several picks, show them as chips and never show a raw key', async () => {
    await page.goto('/dashboard/products/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Tasting notes and pairings only exist for a coffee product.
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /^Coffee$/i }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole('tab', { name: /^Tasting notes/i }).first().click();
    await page.waitForTimeout(1500);

    const chip = page.locator('app-chip-multiselect').first();
    const row = (name: string) =>
      chip.locator('li').filter({ has: page.getByText(name, { exact: true }) }).first();

    // The label is a word, not `common.chipMultiselect.add`.
    const firstLabel = (await row('Chocolate').getByRole('button').first().innerText()).trim();
    expect(firstLabel, 'the Add label is translated, not a raw key').toBe('Add');

    await row('Chocolate').getByRole('button').first().click();
    await row('Caramel').getByRole('button').first().click();
    await page.waitForTimeout(600);

    // Both picks survive — the second must not replace the first.
    await expect(chip.locator('button[aria-label]')).toHaveCount(2);
    await expect(chip.locator('button[aria-label="Remove Chocolate"]')).toBeVisible();
    await expect(chip.locator('button[aria-label="Remove Caramel"]')).toBeVisible();
    await expect(
      page.getByRole('tab', { name: /^Tasting notes/i }).first(),
      'the step badge counts both picks',
    ).toContainText('2');

    // A picked row cannot be added twice.
    await expect(row('Chocolate').getByRole('button').first()).toBeDisabled();

    // And a chip can be taken back off.
    await chip.locator('button[aria-label="Remove Chocolate"]').click();
    await page.waitForTimeout(400);
    await expect(chip.locator('button[aria-label]')).toHaveCount(1);
    await expect(row('Chocolate').getByRole('button').first()).toBeEnabled();

    // No raw key anywhere on the step.
    const body = await page.locator('body').innerText();
    expect(body.match(/common\.[a-zA-Z.]+/g) ?? []).toEqual([]);
  });
});
