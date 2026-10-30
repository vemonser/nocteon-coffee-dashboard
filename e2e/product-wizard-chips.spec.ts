import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * PRODUCTS-04 / W4 — the shared chip-multiselect in the product wizard.
 *
 * The step passed the selection to the component as a `computed` over a
 * FormArray's `.value`, which is not a signal: the component kept the empty
 * first read, so a picked note never became a chip and the next pick silently
 * replaced the previous one. W4 also replaced the table row + "Add" button
 * with SELECTABLE CHIPS, so this spec pins that contract:
 *   - a chip toggles on click and reports `aria-pressed`
 *   - the summary counts the picks and shows each one as a removable chip
 *   - there is no "Add" button and no table row in the component
 *   - no raw translation key reaches the screen
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

  test('a chip toggles, the summary counts the picks and there is no Add button', async () => {
    await page.goto('/dashboard/products/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Tasting notes and pairings only exist for a coffee product.
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /^Coffee$/i }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole('tab', { name: /^Tasting notes/i }).first().click();
    await page.waitForTimeout(1500);

    const chip = page.locator('app-chip-multiselect').first();
    const chipButton = (name: string) =>
      chip.getByRole('button', { name, exact: true }).first();

    // The vocabulary renders as selectable chips, not table rows with "Add".
    await expect(chip.getByRole('button', { name: 'Add' })).toHaveCount(0);
    await expect(chip.locator('table')).toHaveCount(0);
    await expect(chipButton('Chocolate')).toHaveAttribute('aria-pressed', 'false');

    await chipButton('Chocolate').click();
    await chipButton('Caramel').click();
    await page.waitForTimeout(500);

    // Both picks survive — the second must not replace the first.
    await expect(chipButton('Chocolate')).toHaveAttribute('aria-pressed', 'true');
    await expect(chipButton('Caramel')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip.getByText('2 selected')).toBeVisible();
    await expect(chip.locator('button[aria-label="Remove Chocolate"]')).toBeVisible();
    await expect(chip.locator('button[aria-label="Remove Caramel"]')).toBeVisible();
    await expect(
      page.getByRole('tab', { name: /^Tasting notes/i }).first(),
      'the step badge counts both picks',
    ).toContainText('2');

    // The manage link names the destination (W4).
    await expect(page.getByRole('button', { name: 'Manage tasting notes' })).toBeVisible();

    // A selected chip toggles back off.
    await chipButton('Chocolate').click();
    await page.waitForTimeout(400);
    await expect(chipButton('Chocolate')).toHaveAttribute('aria-pressed', 'false');
    await expect(chip.getByText('1 selected')).toBeVisible();

    // No raw key anywhere on the step.
    const body = await page.locator('body').innerText();
    expect(body.match(/common\.[a-zA-Z.]+/g) ?? []).toEqual([]);
  });
});
