import { test } from '@playwright/test';
import { gotoLogin, fillLoginForm, submitLogin, creds } from './helpers/auth';

test('roast-level list loads', async ({ page }) => {
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);
  await page.waitForURL('**/dashboard');
  await page.goto('http://localhost:4200/dashboard/roast-levels');
  await page.waitForTimeout(2000);
  console.log('Roast levels loaded');
  const rows = await page.locator('tbody tr').count();
  console.log('Rows:', rows);
});
