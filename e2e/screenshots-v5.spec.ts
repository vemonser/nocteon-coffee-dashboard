import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import fs from 'fs';
const EVIDENCE_ROOT = '/home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/evidence';

const WIDTHS = [375, 768, 1024, 1440, 1920];
const LANGS = ['en', 'ar'];
const THEMES = ['light', 'dark'];

test.describe('V5 Screenshots', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await gotoLogin(page);
    await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
    const result = await submitLogin(page);
    expect(result.role, 'requires ADMIN').toBe('ADMIN');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  for (const lang of LANGS) {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        test(`categories-active-${lang}-${theme}-${width}`, async () => {
          await page.evaluate(([l, t]) => {
            localStorage.setItem('language', l);
            localStorage.setItem('nocteon-theme', t);
          }, [lang, theme]);
          await page.setViewportSize({ width, height: 900 });
          await page.goto('http://localhost:4200/dashboard/categories');
          await page.waitForSelector('table', { timeout: 10000 });
          await page.waitForTimeout(500);
          const dir = `/home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/evidence/V5/categories-active/${lang}/${theme}`;
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${width}.png`, fullPage: true });
        });

        test(`categories-trash-${lang}-${theme}-${width}`, async () => {
          await page.evaluate(([l, t]) => {
            localStorage.setItem('language', l);
            localStorage.setItem('nocteon-theme', t);
          }, [lang, theme]);
          await page.setViewportSize({ width, height: 900 });
          await page.goto('http://localhost:4200/dashboard/categories?view=trash');
          await page.waitForSelector('table', { timeout: 10000 });
          await page.waitForTimeout(500);
          const dir = `/home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/evidence/V5/categories-trash/${lang}/${theme}`;
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${width}.png`, fullPage: true });
        });

        test(`category-detail-${lang}-${theme}-${width}`, async () => {
          await page.evaluate(([l, t]) => {
            localStorage.setItem('language', l);
            localStorage.setItem('nocteon-theme', t);
          }, [lang, theme]);
          await page.setViewportSize({ width, height: 900 });
          await page.goto('http://localhost:4200/dashboard/categories/coffee');
          await page.waitForSelector('hlm-card', { timeout: 10000 });
          await page.waitForTimeout(500);
          const dir = `/home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/evidence/V5/category-detail/${lang}/${theme}`;
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${width}.png`, fullPage: true });
        });

        test(`add-dialog-${lang}-${theme}-${width}`, async () => {
          await page.evaluate(([l, t]) => {
            localStorage.setItem('language', l);
            localStorage.setItem('nocteon-theme', t);
          }, [lang, theme]);
          await page.setViewportSize({ width, height: 900 });
          await page.goto('http://localhost:4200/dashboard/categories');
          await page.waitForSelector('table', { timeout: 10000 });
          await page.waitForTimeout(500);
          // Open add dialog
          const addBtn = page.locator('button:has-text("Add"), button:has-text("إضافة")').first();
          await addBtn.click();
          await page.waitForTimeout(500);
          const dir = `/home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/evidence/V5/add-dialog/${lang}/${theme}`;
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${width}.png`, fullPage: true });
          // Close dialog
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        });
      }
    }
  }
});