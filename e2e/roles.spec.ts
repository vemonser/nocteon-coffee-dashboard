import { test, expect, type Page } from '@playwright/test';

/**
 * Who gets into the dashboard shell, and what the shell shows them.
 *
 * Product rule: the shell is opened by the `dashboard:read` PERMISSION, not by
 * a role. ADMIN holds every permission; MODERATOR holds this one and sees only
 * the pages its other permissions unlock. Storefront accounts hold none.
 *
 * The API is mocked so this suite tests the client gate, not the backend's.
 */

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))
    .toString('base64url');
  return `header.${payload}.signature`;
}

function user(role: string, permissions: string[]) {
  return {
    id: 7,
    email: `${role.toLowerCase()}@example.com`,
    username: role.toLowerCase(),
    role,
    firstName: 'Test',
    lastName: role,
    avatarUrl: null,
    permissions,
  };
}

const MODERATOR = user('MODERATOR', ['dashboard:read', 'order:read', 'review:read']);

/** A role that does not exist in the seed: proof the gate is the permission. */
const SUPPORT = user('SUPPORT', ['dashboard:read']);

const CUSTOMER = user('CUSTOMER', ['order:create', 'order:read']);

async function signInAs(page: Page, sessionUser: Record<string, unknown>) {
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    if (url.includes('/api/auth/refresh')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { accessToken: fakeJwt(), expiresIn: 900, user: sessionUser },
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

test.describe('dashboard entry', () => {
  test('a moderator reaches /dashboard and sees no notification bell', async ({ page }) => {
    await signInAs(page, MODERATOR);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('header').first()).toBeVisible();
    // The bell is permission-gated (notification:read), so it must be absent.
    await expect(page.getByTestId('notifications-bell')).toHaveCount(0);
  });

  test('any role that holds dashboard:read gets in', async ({ page }) => {
    // SUPPORT is not a seeded role; only the permission is checked.
    await signInAs(page, SUPPORT);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('a moderator without dashboard:read is sent to /unauthorized', async ({ page }) => {
    await signInAs(page, user('MODERATOR', ['order:read', 'review:read']));

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.getByTestId('unauthorized-slug')).toHaveText('dashboard:read');
  });

  test('a storefront account never reaches the dashboard', async ({ page }) => {
    await signInAs(page, CUSTOMER);

    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/unauthorized/);
  });
});
