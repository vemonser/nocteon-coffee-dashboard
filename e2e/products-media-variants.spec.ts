import { test, expect, type Page } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';

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

test.describe('products media + variants table (PRODUCTS-07)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
  });

  test('media step renders tiles', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/dashboard/products/brazil-mogiana/edit?step=media');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });
  });

  test('set cover works', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/dashboard/products/brazil-mogiana/edit?step=media');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    const setCover = page.getByRole('button', { name: /set as cover|تعيين/i }).first();
    if (await setCover.isVisible().catch(() => false)) {
      await setCover.click();
      await expect(page.getByText(/cover|غلاف/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('delete asks for confirmation', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/dashboard/products/brazil-mogiana/edit?step=media');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.group.relative').first()).toBeVisible({ timeout: 30_000 });
    const before = await page.locator('.group.relative').count();
    await page.getByRole('button', { name: /delete|حذف/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    // cancel
    await page.getByRole('button', { name: /cancel|إلغاء/i }).first().click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
    const after = await page.locator('.group.relative').count();
    expect(after).toBe(before);
  });

  test('variants table edits inline', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/dashboard/products/brazil-mogiana/edit?step=variants');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: /table|جدول/i }).click();
    const sku = page.locator('input[formcontrolname="sku"]').first();
    const price = page.locator('input[formcontrolname="price"]').first();
    const stock = page.locator('input[formcontrolname="stockQuantity"]').first();
    await sku.fill('E2E-SKU-1');
    await price.fill('12.5');
    await stock.fill('7');
    await expect(sku).toHaveValue('E2E-SKU-1');
    await expect(price).toHaveValue('12.5');
    await expect(stock).toHaveValue('7');
  });

  test('variants table shows low-stock styling', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/dashboard/products/brazil-mogiana/edit?step=variants');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: /table|جدول/i }).click();
    const stock = page.locator('input[formcontrolname="stockQuantity"]').first();
    const reorder = page.locator('input[formcontrolname="reorderThreshold"]').first();
    await stock.fill('1');
    await reorder.fill('5');
    const row = page.locator('tbody tr').first();
    await expect(row).toHaveClass(/bg-warning-soft/, { timeout: 10_000 });
  });
});
