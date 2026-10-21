import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * The reviews console.
 *
 * <p>Three things are worth proving here: the PENDING tab is where a
 * moderator lands, the count line names the entity, and the product column
 * shows a name — not a slug.
 *
 * <p>ONE shared session, not one login per test: POST /api/auth/login is
 * rate limited to 5/minute per IP and per identifier, so logging in per
 * test rate-limits the suite against itself.
 */
async function loginAsAdmin(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await gotoLogin(page);
    await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
    const result = await submitLogin(page);

    if (result.status === 429) {
      await page.waitForTimeout(20_000);
      continue;
    }

    expect(result.role, 'the suite requires an ADMIN account').toBe('ADMIN');
    return;
  }

  throw new Error('login stayed rate-limited (429) after 3 attempts');
}

test.describe('the reviews console', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    await page.goto('/dashboard/reviews');
    await expect(page.getByTestId('reviews-count')).toBeVisible();
  });

  test('the pending tab is the default and the count line names the entity', async () => {
    await expect(page.getByTestId('reviews-count')).toContainText(/review/i);

    const pending = page.getByRole('tab', { name: /pending/i });
    await expect(pending).toHaveAttribute('aria-selected', 'true');
  });

  test('the statistics strip shows the average and the pending count', async () => {
    await expect(page.getByTestId('reviews-stat-pending')).toBeVisible();
    await expect(page.getByTestId('reviews-stat-average')).toBeVisible();
    await expect(page.getByTestId('reviews-stat-distribution')).toBeVisible();
  });

  test('a review row shows the product, not a slug', async () => {
    await expect(page.locator('table')).toBeVisible();
    const product = page.locator('td[data-column="main_en"], td[data-column="main_ar"]').first();
    await expect(product).toBeVisible();
    await expect(product).not.toContainText('ethiopia-yirgacheffe');
  });

  test('the product column dominates and the actions column stays compact', async () => {
    await expect(page.locator('table')).toBeVisible();
    const widths = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('table th'));
      return cells.map((c) => ({
        header: (c.textContent ?? '').trim(),
        width: Math.round(c.getBoundingClientRect().width),
      }));
    });

    const actions = widths.find((w) => /actions|الإجراءات/i.test(w.header));
    const data = widths.filter((w) => w !== actions);
    const widest = data.reduce((best, w) => (w.width > best.width ? w : best), {
      width: 0,
      header: '',
    });

    expect(actions).toBeTruthy();
    expect(actions!.width).toBeLessThanOrEqual(160);
    expect(widest.width).toBeGreaterThan(actions!.width * 1.4);
  });
});
