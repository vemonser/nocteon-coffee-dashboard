import { test } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

test('probe sidebar heights + contrast', async ({ page }) => {
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:4200/dashboard/categories');
  await page.waitForTimeout(600);

  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => localStorage.setItem('nocteon-theme', t), theme);
    await page.reload();
    await page.locator('[data-sidebar="group-label"], [data-sidebar=menu-button]').first().waitFor();
    await page.waitForTimeout(300);
    const data = await page.evaluate(() => {
      const bg = (el: HTMLElement): { color: string; rgb: number[] } => {
        let cur: HTMLElement | null = el;
        while (cur) {
          const c = getComputedStyle(cur).backgroundColor;
          if (c && !c.includes('0, 0, 0, 0')) {
            return {
              color: getComputedStyle(cur).color,
              rgb: c.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) as number[],
            };
          }
          cur = cur.parentElement;
        }
        return { color: '', rgb: [] };
      };

      // Group-label buttons + child links measuring.
      const labels = Array.from(document.querySelectorAll('[data-sidebar="group-label"], [data-sidebar="menu-button"]'));
      const linkInfo = Array.from(document.querySelectorAll('[data-sidebar="menu-button"]')).map((el) => {
        const h = Math.round(el.getBoundingClientRect().height);
        return { text: el.textContent?.trim().slice(0, 14), h };
      });
      const first = document.querySelector('[data-sidebar="menu-button"]') as HTMLElement | null;
      const span = first?.querySelector('span');
      const fg = getComputedStyle span as unknown;
      return { linkInfo: linkInfo.slice(0, 8) };
    });
    console.log(theme.toUpperCase(), JSON.stringify(data).slice(0, 500));
  }
});
