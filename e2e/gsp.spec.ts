import { test, expect } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';

test.describe('global search palette', () => {
  test.beforeEach(async ({ page }) => {
    await gotoLogin(page);
    await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
    await submitLogin(page);
    await page.waitForURL('**/dashboard');
  });

  test('opens with Ctrl+K, focuses input, closes with Esc', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palette = page.locator('app-global-search-palette');
    const input = palette.locator('input').first();
    await expect(input).toBeVisible({ timeout: 5_000 });
    await expect(input).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(input).toBeHidden({ timeout: 5_000 });
  });

  test('search shows results and highlights matches', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palette = page.locator('app-global-search-palette');
    const input = palette.locator('input').first();
    await input.fill('ahmed');
    await page.waitForTimeout(700);
    const options = palette.locator('[role="option"]');
    await expect(options.first()).toBeVisible({ timeout: 5_000 });
    await expect(palette.locator('mark').first()).toBeVisible();
  });

  test('keyboard navigation moves active row and Enter opens it', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palette = page.locator('app-global-search-palette');
    const input = palette.locator('input').first();
    await input.fill('ahmed');
    await page.waitForTimeout(700);
    const options = palette.locator('[role="option"]');
    await expect(options.first()).toBeVisible({ timeout: 5_000 });
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    if ((await options.count()) > 1) {
      await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    }
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/dashboard\//, { timeout: 10_000 });
  });

  test('shows no-results state with hint for unknown query', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palette = page.locator('app-global-search-palette');
    const input = palette.locator('input').first();
    await input.fill('zzzzzzz');
    await page.waitForTimeout(700);
    await expect(palette).toContainText(/No results|لا توجد نتائج/i);
    await expect(palette).toContainText(/Check spelling|تحقق من الإملاء/i);
  });

  test('clears the query with the clear button', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const palette = page.locator('app-global-search-palette');
    const input = palette.locator('input').first();
    await input.fill('ahmed');
    const clearBtn = palette.locator('button[aria-label="Clear"], button[aria-label="مسح"]').first();
    await expect(clearBtn).toBeVisible({ timeout: 5_000 });
    await clearBtn.click();
    await expect(input).toHaveValue('');
  });
});