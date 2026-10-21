import { test } from '@playwright/test';
import { gotoLogin, fillLoginForm, submitLogin, creds } from './helpers/auth';

test('dom check', async ({ page }) => {
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);
  await page.waitForURL('**/dashboard');
  
  for (const path of ['/dashboard/categories/coffee', '/dashboard/origins/ethiopia', '/dashboard/farms/yirgacheffe']) {
    await page.goto(`http://localhost:4200${path}`);
    await page.waitForTimeout(2000);
    
    // Check for hlm-card elements
    const cards = await page.locator('hlm-card').count();
    const forms = await page.locator('form').count();
    const grids = await page.locator('.grid').count();
    
    console.log(`${path}: hlm-cards=${cards}, forms=${forms}, grids=${grids}`);
    
    // Check if there's a card with background
    const cardStyles = await page.locator('hlm-card').first().evaluate(el => {
      const computed = window.getComputedStyle(el);
      return `bg: ${computed.backgroundColor}, border: ${computed.border}`;
    });
    console.log(`  First card styles: ${cardStyles}`);
  }
});
