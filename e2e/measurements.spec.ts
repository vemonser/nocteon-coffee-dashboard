import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import fs from 'fs';

const EVIDENCE = '/home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/evidence';

test.describe('V1-V4 Measurements', () => {
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

  // V1: Add dialog measurements
  test('V1 add dialog', async () => {
    await page.evaluate(() => {
      localStorage.setItem('language', 'en');
      localStorage.setItem('nocteon-theme', 'light');
    });
    await page.goto('http://localhost:4200/dashboard/categories');
    await page.waitForSelector('table');
    await page.waitForTimeout(500);

    // Open add dialog
    const addBtn = page.locator('button:has-text("Add category")').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    // Measure footer button widths
    const footerButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('div.flex.gap-3.pt-2.justify-end button');
      return Array.from(buttons).map(b => Math.round(b.getBoundingClientRect().width));
    });

    // Check image upload button text
    const uploadBtnText = await page.evaluate(() => {
      const label = document.querySelector('app-image-upload label');
      return label?.textContent?.trim() || '';
    });

    // Close dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Reopen dialog and check image preview
    await addBtn.click();
    await page.waitForTimeout(300);

    const previewPresent = await page.evaluate(() => {
      const img = document.querySelector('app-image-upload img');
      return !!img;
    });

    // Upload an image, cancel, reopen
    const fileInput = page.locator('app-image-upload input[type="file"]').first();
    // Create a test image
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 10, 10);
      }
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'test.png', { type: 'image/png' });
          const dt = new DataTransfer();
          dt.items.add(file);
          const input = document.querySelector('app-image-upload input[type="file"]') as HTMLInputElement;
          if (input) {
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
    });
    await page.waitForTimeout(500);

    // Cancel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Reopen
    await addBtn.click();
    await page.waitForTimeout(300);

    const previewAfterReopen = await page.evaluate(() => {
      const img = document.querySelector('app-image-upload img');
      return !!img;
    });

    const results = {
      ticket: 'V1',
      imagePreviewPresentAfterReopen: previewAfterReopen,
      footerButtonWidths: footerButtons,
      uploadButtonText: uploadBtnText,
    };

    fs.writeFileSync(`${EVIDENCE}/V1-results.json`, JSON.stringify(results, null, 2));
    console.log('V1 results:', JSON.stringify(results));
  });

  // V2: Lists measurements
  test('V2 lists', async () => {
    const gaps: Record<string, number> = {};

    for (const width of [1440, 1920]) {
      for (const sidebar of ['open', 'collapsed']) {
        for (const lang of ['en', 'ar']) {
          await page.evaluate(([l]) => {
            localStorage.setItem('language', l);
            localStorage.setItem('nocteon-theme', 'light');
          }, [lang]);
          await page.setViewportSize({ width, height: 900 });
          await page.goto('http://localhost:4200/dashboard/categories');
          await page.waitForSelector('table');
          await page.waitForTimeout(500);

          if (sidebar === 'collapsed') {
            // Collapse sidebar
            const trigger = page.locator('button[hlmSidebarTrigger], button[aria-label="Toggle sidebar"]').first();
            if (await trigger.isVisible()) {
              await trigger.click();
              await page.waitForTimeout(300);
            }
          }

          const gap = await page.evaluate(() => {
            const table = document.querySelector('table');
            if (!table) return 0;
            const firstRow = table.querySelector('tbody tr');
            if (!firstRow) return 0;
            const texts: { x: number; xEnd: number; y: number }[] = [];
            const walker = document.createTreeWalker(firstRow, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              const node = walker.currentNode;
              if (!node.textContent?.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              const rect = range.getBoundingClientRect();
              if (rect.width > 0) texts.push({ x: rect.left, xEnd: rect.right, y: rect.top });
            }
            texts.sort((a, b) => a.x - b.x);
            let maxGap = 0;
            for (let i = 1; i < texts.length; i++) {
              if (Math.abs(texts[i].y - texts[i - 1].y) < 30) {
                maxGap = Math.max(maxGap, texts[i].x - texts[i - 1].xEnd);
              }
            }
            return Math.max(0, Math.round(maxGap));
          });

          const key = `${width}-${sidebar}-${lang}`;
          gaps[key] = gap;

          // Expand sidebar again for next iteration
          if (sidebar === 'collapsed') {
            const trigger = page.locator('button[hlmSidebarTrigger], button[aria-label="Toggle sidebar"]').first();
            if (await trigger.isVisible()) {
              await trigger.click();
              await page.waitForTimeout(300);
            }
          }
        }
      }
    }

    // Check pencil icon is anchor
    await page.evaluate(() => {
      localStorage.setItem('language', 'en');
      localStorage.setItem('nocteon-theme', 'light');
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:4200/dashboard/categories');
    await page.waitForSelector('table');
    await page.waitForTimeout(500);

    const pencilInfo = await page.evaluate(() => {
      const pencil = document.querySelector('app-actions-cell a:has(ng-icon[name="lucidePencil"])');
      if (!pencil) {
        // Try alternative selector
        const anchors = document.querySelectorAll('app-actions-cell a');
        for (const a of anchors) {
          if (a.querySelector('ng-icon')) {
            return { tagName: a.tagName, href: a.getAttribute('href') || a.getAttribute('routerlink') };
          }
        }
        return null;
      }
      return { tagName: pencil.tagName, href: pencil.getAttribute('href') };
    });

    const results = {
      ticket: 'V2',
      pencilIcon: pencilInfo,
      textGaps: gaps,
    };

    fs.writeFileSync(`${EVIDENCE}/V2-results.json`, JSON.stringify(results, null, 2));
    console.log('V2 results:', JSON.stringify(results));
  });

  // V3: Category detail measurements
  test('V3 category detail', async () => {
    await page.evaluate(() => {
      localStorage.setItem('language', 'en');
      localStorage.setItem('nocteon-theme', 'light');
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:4200/dashboard/categories/coffee');
    await page.waitForSelector('hlm-card');
    await page.waitForTimeout(500);

    // Check save button disabled state before editing
    const saveDisabledBefore = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.includes('Save'));
      return btn?.hasAttribute('disabled') || false;
    });

    // Make a change
    const nameInput = page.locator('input[id^="category-name-"]').first();
    await nameInput.fill('Coffee Modified');
    await page.waitForTimeout(300);

    const saveDisabledAfter = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.includes('Save'));
      return btn?.hasAttribute('disabled') || false;
    });

    // Revert
    await nameInput.fill('Coffee');
    await page.waitForTimeout(300);

    const results = {
      ticket: 'V3',
      saveButtonDisabledBeforeEdit: saveDisabledBefore,
      saveButtonDisabledAfterEdit: saveDisabledAfter,
    };

    fs.writeFileSync(`${EVIDENCE}/V3-results.json`, JSON.stringify(results, null, 2));
    console.log('V3 results:', JSON.stringify(results));
  });

  // V4: Sidebar measurements
  test('V4 sidebar', async () => {
    await page.evaluate(() => {
      localStorage.setItem('language', 'en');
      localStorage.setItem('nocteon-theme', 'light');
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:4200/dashboard');
    await page.waitForTimeout(500);

    // Measure sidebar item height and group header height
    const heights = await page.evaluate(() => {
      const item = document.querySelector('hlm-sidebar-content a');
      const headers = Array.from(document.querySelectorAll('hlm-sidebar-content button'));
      const header = headers.find(b => b.textContent?.includes('Catalog'));
      return {
        itemHeight: item ? Math.round(item.getBoundingClientRect().height) : 0,
        groupHeaderHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
      };
    });

    // Check if Catalog and Settings can be open simultaneously
    // Clear localStorage first
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(500);

    // Open Catalog
    const catalogBtn = page.locator('button:has-text("Catalog")').first();
    await catalogBtn.click();
    await page.waitForTimeout(300);

    // Open Settings
    const settingsBtn = page.locator('button:has-text("Settings")').first();
    await settingsBtn.click();
    await page.waitForTimeout(300);

    const bothOpen = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('hlm-sidebar-content button'));
      const catalog = headers.find(b => b.textContent?.includes('Catalog'));
      const settings = headers.find(b => b.textContent?.includes('Settings'));
      return {
        catalogOpen: catalog?.getAttribute('aria-expanded') === 'true',
        settingsOpen: settings?.getAttribute('aria-expanded') === 'true',
      };
    });

    const results = {
      ticket: 'V4',
      sidebarItemHeight: heights.itemHeight,
      groupHeaderHeight: heights.groupHeaderHeight,
      catalogAndSettingsBothOpen: bothOpen,
    };

    fs.writeFileSync(`${EVIDENCE}/V4-results.json`, JSON.stringify(results, null, 2));
    console.log('V4 results:', JSON.stringify(results));
  });
});