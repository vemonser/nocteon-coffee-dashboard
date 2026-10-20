import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import fs from 'fs';

const EVIDENCE = '/home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/evidence';

test.describe('V5 Overflow Check', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await gotoLogin(page);
    await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
    const result = await submitLogin(page);
    expect(result.role).toBe('ADMIN');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('check overflows', async () => {
  test.setTimeout(300000);
    const issues: string[] = [];

    for (const width of [375, 768, 1024, 1440, 1920]) {
      for (const lang of ['en', 'ar']) {
        await page.evaluate(([l]) => {
          localStorage.setItem('language', l);
          localStorage.setItem('nocteon-theme', 'light');
        }, [lang]);
        await page.setViewportSize({ width, height: 900 });

        // Categories list
        await page.goto('http://localhost:4200/dashboard/categories');
        await page.waitForTimeout(1500);

        const listOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (listOverflow > 1) issues.push(`categories-list ${width}px ${lang}: horizontal scroll ${listOverflow}px`);

        // Category detail
        await page.goto('http://localhost:4200/dashboard/categories/coffee');
        await page.waitForTimeout(1500);

        const detailOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (detailOverflow > 1) issues.push(`category-detail ${width}px ${lang}: horizontal scroll ${detailOverflow}px`);

        // Add dialog
        await page.goto('http://localhost:4200/dashboard/categories');
        await page.waitForTimeout(1000);
        const addBtn = page.locator('button').filter({ hasText: /Add|إضافة/ }).first();
        if (await addBtn.isVisible()) {
          await addBtn.click();
          await page.waitForTimeout(500);
          const dialogOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          if (dialogOverflow > 1) issues.push(`add-dialog ${width}px ${lang}: horizontal scroll ${dialogOverflow}px`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
    }

    const results = {
      ticket: 'V5',
      overflowAndClippingIssues: issues,
      totalIssues: issues.length,
    };

    fs.writeFileSync(`${EVIDENCE}/V5-results.json`, JSON.stringify(results, null, 2));
    console.log('V5 results:', JSON.stringify(results));
  });
});