import { test, expect } from '@playwright/test';

test('unsaved guard: product edit', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[formControlName="identifier"]', process.env['E2E_ADMIN_EMAIL'] || 'admin@aurum.local');
  await page.fill('input[formControlName="password"]', process.env['E2E_ADMIN_PASSWORD'] || 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/);

  // open first product edit
  await page.goto('/dashboard/products');
  await page.waitForTimeout(2000);
  const firstEdit = page.locator('table tbody tr:first-child a[href*="/edit"], table tbody tr:first-child button:has-text("Edit")').first();
  if (await firstEdit.count()) await firstEdit.click();
  await page.waitForTimeout(2000);

  // edit a field
  const input = page.locator('input[formControlName="name"], textarea[formControlName="description"]').first();
  if (await input.count()) await input.fill('QA unsaved edit');

  // navigate via sidebar
  await page.click('a[href="/dashboard"]').catch(() => {});
  await page.waitForTimeout(1000);
  await expect(page.locator('text=Unsaved changes')).toBeVisible();

  // Stay keeps value
  await page.click('button:has-text("Stay on page")');
  await page.waitForTimeout(500);
  const val = await input.inputValue().catch(() => '');
  expect(val).toContain('QA unsaved edit');

  // click again then discard
  await page.click('a[href="/dashboard"]').catch(() => {});
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Discard changes")');
  await page.waitForTimeout(2000);
  // navigated
  await expect(page).toHaveURL(/dashboard$/);
});
EOF
echo done