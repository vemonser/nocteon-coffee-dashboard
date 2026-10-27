import { test, expect } from '@playwright/test';

function fakeJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }),
  ).toString('base64url');
  return `header.${payload}.signature`;
}

test.describe('Change password', () => {
  test('sends the backend contract and forces a clean re-login', async ({ page }) => {
    const admin = {
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

    await page.route('**/api/auth/refresh', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(admin) }),
    );

    let body: unknown = null;
    await page.route('**/api/users/me/password', async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Password changed' }),
      });
    });

    await page.goto('/dashboard/profile');
    await page.locator('#currentPassword').fill('old-password-123');
    await page.locator('#newPassword').fill('new-password-456');
    await page.locator('#confirmPassword').fill('new-password-456');
    await page.getByRole('button', { name: /change password/i }).click();

    await expect(page).toHaveURL(/\/login$/);
    expect(body).toEqual({
      oldPassword: 'old-password-123',
      newPassword: 'new-password-456',
      confirmPassword: 'new-password-456',
    });
  });
});
