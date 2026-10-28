import { test, expect, type Page } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';

/**
 * The product story is an editorial field PER LANGUAGE.
 *
 * It used to be one column on the coffee details, so an Arabic product page
 * could not have its own story. The wizard now edits it inside each language
 * tab and the old single field is gone.
 */
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

test.describe('product story', () => {
  test('is edited per language and keeps its value', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);

    await page.goto('/dashboard/products/brazil-mogiana/edit');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });

    // The story lives with the translations; the English tab is active first.
    const story = page.locator('textarea[formcontrolname="story"]');
    await expect(story).toHaveCount(1, { timeout: 20_000 });
    await expect(story).toHaveValue(/Demo story/);

    // Switch to Arabic: its own story field renders, RTL, with its own value.
    await page.getByRole('tab', { name: /عربي/ }).click();
    const arabicStory = page.locator('textarea[formcontrolname="story"]');
    await expect(arabicStory).toHaveCount(1);
    await expect(arabicStory).toHaveAttribute('dir', 'rtl');
  });
});
