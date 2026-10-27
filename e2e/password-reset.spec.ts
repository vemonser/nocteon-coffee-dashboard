import { test, expect } from '@playwright/test';

/**
 * Password recovery E2E — forgot → reset, with the backend stubbed.
 *
 * ── BACKEND CONTRACT ──────────────────────────────────────────────────────
 *   POST /api/auth/forgot-password  { email }
 *   POST /api/auth/reset-password   { email, otp, newPassword, confirmPassword }
 *
 * The request step is deliberately generic (no account enumeration): a 200
 * means "if that address exists, a code was sent", never "the address exists".
 */

const FORGOT = '**/api/auth/forgot-password';
const RESET = '**/api/auth/reset-password';

/** No session for these tests: the initializer refresh must fail, not 200. */
async function stubLoggedOut(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'No session' }),
    }),
  );
}

test.describe('Password recovery', () => {
  test('the login page links to the recovery form', async ({ page }) => {
    await stubLoggedOut(page);
    await page.goto('/login');

    await page.getByRole('link', { name: /forgot password/i }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
  });

  test('requests a code and moves on to the reset step', async ({ page }) => {
    await stubLoggedOut(page);

    let body: unknown = null;
    await page.route(FORGOT, async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'If the account exists, a code was sent' }),
      });
    });

    await page.goto('/forgot-password');
    await page.locator('#email').fill('admin@example.com');
    await page.getByRole('button', { name: /send reset code/i }).click();

    await expect(page.getByRole('heading', { name: /reset your password/i })).toBeVisible();
    expect(body).toEqual({ email: 'admin@example.com' });
  });

  test('resets the password with the backend contract and returns to login', async ({ page }) => {
    await stubLoggedOut(page);

    let body: unknown = null;
    await page.route(RESET, async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Password reset successfully' }),
      });
    });

    await page.goto('/reset-password?email=admin%40example.com');
    await page.locator('#otp').fill('123456');
    await page.locator('#new-password').fill('new-password-456');
    await page.locator('#confirm-password').fill('new-password-456');
    await page.getByRole('button', { name: /^reset password$/i }).click();

    await expect(page).toHaveURL(/\/login$/);
    expect(body).toEqual({
      email: 'admin@example.com',
      otp: '123456',
      newPassword: 'new-password-456',
      confirmPassword: 'new-password-456',
    });
  });

  test('never calls the API when the passwords do not match', async ({ page }) => {
    await stubLoggedOut(page);

    let calls = 0;
    await page.route(RESET, async (route) => {
      calls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/reset-password?email=admin%40example.com');
    await page.locator('#otp').fill('123456');
    await page.locator('#new-password').fill('new-password-456');
    await page.locator('#confirm-password').fill('different-password-789');
    await page.getByRole('button', { name: /^reset password$/i }).click();

    await expect(page).toHaveURL(/\/reset-password/);
    expect(calls, 'a mismatched confirmation must be caught client-side').toBe(0);
  });
});
