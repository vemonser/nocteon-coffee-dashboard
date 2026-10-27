import { test, expect, Page } from '@playwright/test';

/**
 * Dashboard-side OAuth2 callback contract:
 *   /{locale}/oauth2/callback?code=<one-time-code>
 * The page exchanges the code and the access token never appears in the URL.
 *
 * Google itself is not automated here; the backend redirect is mocked at the
 * HTTP boundary, which is the part the dashboard owns.
 */

function fakeJwt(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))
    .toString('base64url');
  return `header.${payload}.signature`;
}

async function mockRefresh(req: Page): Promise<void> {
  await req.route('**/api/auth/refresh', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
}

function adminSession() {
  return {
    data: {
      accessToken: fakeJwt(),
      expiresIn: 900,
      user: {
        id: 1,
        email: 'admin@example.com',
        username: 'admin',
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
        avatarUrl: null,
        permissions: ['dashboard:read'],
      },
    },
  };
}

test.describe('OAuth2 callback', () => {
  test('the login page sends the browser to the backend Google authorization endpoint', async ({ page }) => {
    await mockRefresh(page);
    await page.route('**/oauth2/authorization/google', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html>google</html>' }),
    );

    await page.goto('/login');
    await page.getByRole('button', { name: /google/i }).click();

    await expect(page).toHaveURL(/\/oauth2\/authorization\/google$/);
  });

  test('exchanges the one-time code and lands an admin on the dashboard', async ({ page }) => {
    await mockRefresh(page);
    const code = '123e4567-e89b-12d3-a456-426614174000';
    let exchangedCode: string | null = null;

    await page.route('**/api/auth/oauth2/exchange', async (route) => {
      exchangedCode = route.request().postDataJSON()?.code ?? null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(adminSession()),
      });
    });

    await page.goto(`/en/oauth2/callback?code=${code}`);

    await expect(page).toHaveURL(/\/dashboard$/);
    expect(exchangedCode).toBe(code);
    expect(page.url()).not.toContain('code=');
    expect(page.url()).not.toContain('token=');
  });

  test('keeps a non-admin out and explains why', async ({ page }) => {
    await mockRefresh(page);
    await page.route('**/api/auth/oauth2/exchange', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            accessToken: fakeJwt(),
            expiresIn: 900,
            user: {
              id: 2,
              email: 'customer@example.com',
              username: 'customer',
              role: 'CUSTOMER',
              firstName: 'Customer',
              lastName: 'User',
              avatarUrl: null,
              permissions: [],
            },
          },
        }),
      }),
    );

    await page.goto('/en/oauth2/callback?code=123e4567-e89b-12d3-a456-426614174000');

    await expect(page).toHaveURL(/\/en\/oauth2\/callback$/);
    await expect(page.getByText(/access denied/i).first()).toBeVisible();
  });

  test('shows a recoverable error when the code is missing', async ({ page }) => {
    await mockRefresh(page);

    await page.goto('/en/oauth2/callback');

    await expect(page).toHaveURL(/\/en\/oauth2\/callback$/);
    await expect(page.getByText(/missing or expired/i).first()).toBeVisible();
  });
});
