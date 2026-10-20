import { test, expect, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * The four-cell evidence for the reviews console and the message list.
 *
 * <p>light/dark × EN/AR. The language and the theme are persisted in
 * localStorage and picked up by the NEXT load, so each cell is a separate
 * navigation — never a reload racing a navigation.
 */
const CELLS = [
  { name: 'en-light', lang: 'en', theme: 'light' },
  { name: 'en-dark', lang: 'en', theme: 'dark' },
  { name: 'ar-light', lang: 'ar', theme: 'light' },
  { name: 'ar-dark', lang: 'ar', theme: 'dark' },
] as const;

async function applyCell(page: Page, lang: string, theme: string): Promise<void> {
  await page.evaluate(
    ([l, t]) => {
      localStorage.setItem('language', l);
      localStorage.setItem('nocteon-theme', t);
    },
    [lang, theme],
  );
}

test('the four cells of both pages', async ({ page }) => {
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);

  for (const cell of CELLS) {
    await applyCell(page, cell.lang, cell.theme);

    await page.goto('/dashboard/reviews', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('reviews-count')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `evidence/reviews-messages/${cell.name}/reviews.png`,
      fullPage: true,
    });

    await page.goto('/dashboard/contact-messages', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('contact-messages-count')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `evidence/reviews-messages/${cell.name}/contact-messages.png`,
      fullPage: true,
    });
  }
});
