import { test, expect, type Page } from '@playwright/test';

/**
 * Who gets into the dashboard shell, and what the shell shows them.
 *
 * Product rule: ADMIN and MODERATOR share the shell; the pages inside are
 * permission-gated. Storefront accounts never see it.
 *
 * The API is mocked so this suite tests the client gate, not the backend's.
 */

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))
    .toString('base64url');
  return `header.${payload}.signature`;
}

const MODERATOR = {
  id: 7,
  email: 'moderator@example.com',
  username: 'moderator',
  role: 'MODERATOR',
  firstName: 'Mod',
  lastName: 'Erator',
  avatarUrl: null,
  // No notification:read, no user:read.
  permissions: ['dashboard:read', 'order:read', 'review:read', 'contact:read'],
};

const CUSTOMER = {
  id: 9,
  email: 'customer@example.com',
  username: 'customer',
  role: 'CUSTOMER',
  firstName: 'Cus',
  lastName: 'Tomer',
  avatarUrl: null,
  permissions: ['order:create', 'order:read'],
};

async function signInAs(page: Page, user: Record<string, unknown>) {
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    if (url.includes('/api/auth/refresh')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { accessToken: fakeJwt(), expiresIn: 900, user },
        }),
      });
    }
    // Every widget answers with an empty body; this suite only cares about
    // the shell and the route gates.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

test.describe('dashboard roles', () => {
  test('a moderator reaches the dashboard and sees no notification bell', async ({ page }) => {
    await signInAs(page, MODERATOR);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('header').first()).toBeVisible();
    // The bell is permission-gated (notification:read), so it must be absent.
    await expect(page.getByTestId('notifications-bell')).toHaveCount(0);
  });

  test('a moderator hitting a page they lack permission for is sent to /unauthorized', async ({
    page,
  }) => {
    await signInAs(page, MODERATOR);

    await page.goto('/dashboard/notifications');

    await expect(page).toHaveURL(/\/unauthorized$/);
  });

  test('a storefront account still never reaches the dashboard', async ({ page }) => {
    await signInAs(page, CUSTOMER);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login/);
  });
});
