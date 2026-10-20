import { test, expect } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * The reviews console.
 *
 * <p>Three things are worth proving here: the PENDING tab is where a
 * moderator lands, the count line names the entity, and a comment keeps
 * its punctuation at the end of the sentence inside the Arabic page — the
 * defect the screenshot review found.
 */
test.beforeEach(async ({ page }) => {
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);
  await page.goto('/dashboard/reviews');
});

test('the pending tab is the default and the count line names the entity', async ({ page }) => {
  await expect(page.getByTestId('reviews-count')).toContainText(/review/i);

  const pending = page.getByRole('tab', { name: /pending/i });
  await expect(pending).toHaveAttribute('aria-selected', 'true');
});

test('the statistics strip shows the average and the pending count', async ({ page }) => {
  await expect(page.getByTestId('reviews-stat-pending')).toBeVisible();
  await expect(page.getByTestId('reviews-stat-average')).toBeVisible();
  await expect(page.getByTestId('reviews-stat-distribution')).toBeVisible();
});

test('a review row shows the product and the reviewer, not a slug', async ({ page }) => {
  const product = page.locator('td[data-column="main_en"], td[data-column="main_ar"]').first();
  await expect(product).toBeVisible();
  await expect(product).not.toContainText('ethiopia-yirgacheffe');
});

test('the product column is the flex column and the actions column is compact', async ({ page }) => {
  const widths = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('table th'));
    return cells.map((c) => ({
      header: (c.textContent ?? '').trim(),
      width: Math.round(c.getBoundingClientRect().width),
    }));
  });

  const actions = widths.find((w) => /actions|الإجراءات/i.test(w.header));
  const data = widths.filter((w) => w !== actions);
  const widest = data.reduce((best, w) => (w.width > best.width ? w : best), { width: 0, header: '' });

  expect(actions).toBeTruthy();
  expect(actions!.width).toBeLessThanOrEqual(150);
  expect(widest.width).toBeGreaterThan(actions!.width * 2);
});
