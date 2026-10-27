import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Notifications — pagination, the unread filter and the badge, with the API
 * stubbed. These assert behaviour the store owns, not backend data.
 */

const BASE = /\/api\/dashboard\/notifications(\?|$)/;
const UNREAD_COUNT = /\/api\/dashboard\/notifications\/unread-count$/;
const READ_ALL = /\/api\/dashboard\/notifications\/read-all$/;
const PER_PAGE = 2;
const TOTAL = 6;

function fakeJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }),
  ).toString('base64url');
  return `header.${payload}.signature`;
}

function row(id: number, read = false) {
  return {
    id,
    type: 'TEST_EVENT',
    title: `Notification ${id}`,
    message: `Body ${id}`,
    read,
    createdAt: new Date().toISOString(),
  };
}

function pageBody(pageIndex: number, read = false) {
  const first = pageIndex * PER_PAGE + 1;
  return {
    success: true,
    data: {
      content: [row(first, read), row(first + 1, read)],
      page: pageIndex,
      size: PER_PAGE,
      totalElements: TOTAL,
      totalPages: TOTAL / PER_PAGE,
      last: pageIndex >= TOTAL / PER_PAGE - 1,
    },
  };
}

async function signInAsAdmin(page: Page) {
  // The shell asks for nav counts; answer it so no real 401 leaks in.
  await page.route('**/api/dashboard/nav-counts', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    }),
  );

  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
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
            permissions: ['notification:read', 'notification:update', 'notification:delete'],
          },
        },
      }),
    }),
  );
}

async function stubNotifications(
  page: Page,
  options: { unreadCount?: number; onRequest?: (route: Route) => boolean } = {},
) {
  const requests: URL[] = [];

  await page.route(BASE, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);

    if (options.onRequest?.(route)) return;

    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const index = Number(url.searchParams.get('page') ?? 0);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageBody(index, unreadOnly)),
    });
  });

  await page.route(UNREAD_COUNT, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: options.unreadCount ?? 3 }),
    }),
  );

  return requests;
}

test.describe('Notifications page', () => {
  test('pages forward and back without losing its place', async ({ page }) => {
    await signInAsAdmin(page);
    const requests = await stubNotifications(page);

    await page.goto('/dashboard/notifications');

    await expect(page.getByText(/Page 1 of 3/)).toBeVisible();
    await expect(page.getByText('Notification 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText(/Page 2 of 3/)).toBeVisible();
    await expect(page.getByText('Notification 3', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeEnabled();

    await page.getByRole('button', { name: 'Previous page' }).click();

    await expect(page.getByText(/Page 1 of 3/)).toBeVisible();
    await expect(page.getByText('Notification 1', { exact: true })).toBeVisible();

    // Three loads: initial, next, back — each read the page the UI showed.
    expect(requests.map((u) => u.searchParams.get('page'))).toEqual(['0', '1', '0']);
  });

  test('the unread tab requests unread rows and empties after mark-all', async ({ page }) => {
    await signInAsAdmin(page);
    const requests = await stubNotifications(page, { unreadCount: 2 });

    await page.route(READ_ALL, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'All marked as read' }),
      }),
    );

    await page.goto('/dashboard/notifications');
    await page.getByRole('tab', { name: /unread/i }).click();

    await expect
      .poll(() => requests.some((u) => u.searchParams.get('unreadOnly') === 'true'))
      .toBe(true);
    await expect(page.getByText('Notification 1', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /mark all as read/i }).click();

    await expect(page.getByText('Notification 1', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/all caught up/i)).toBeVisible();
  });

  test('deleting from the bell asks first, then deletes', async ({ page }) => {
    await signInAsAdmin(page);
    await stubNotifications(page, { unreadCount: 2 });

    const deletes: string[] = [];
    await page.route(/\/api\/dashboard\/notifications\/\d+$/, (route) => {
      if (route.request().method() === 'DELETE') deletes.push(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Notification deleted' }),
      });
    });

    await page.goto('/dashboard/notifications');
    await page.getByTestId('notifications-bell').click();

    const panel = page.getByTestId('notifications-popover');
    await expect(panel).toContainText('Notification 1');

    await panel.getByRole('button', { name: 'More actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).toHaveCount(0);
    expect(deletes, 'cancelling must not delete anything').toEqual([]);

    // The modal takes focus, so the bell reopens before the next action.
    await page.getByTestId('notifications-bell').click();
    const reopened = page.getByTestId('notifications-popover');
    await expect(reopened).toContainText('Notification 1');

    await reopened.getByRole('button', { name: 'More actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    await expect.poll(() => deletes.length).toBe(1);
    // The row leaves the shared store, so it is gone from the page behind too.
    await expect(page.getByText('Notification 1', { exact: true })).toHaveCount(0);
  });

  test('the bell badge reads the unread count and the panel loads on open', async ({ page }) => {
    await signInAsAdmin(page);
    await stubNotifications(page, { unreadCount: 3 });

    await page.goto('/dashboard/notifications');
    const bell = page.getByTestId('notifications-bell');

    await expect(bell).toContainText('3');
    await bell.click();

    await expect(page.getByTestId('notifications-popover')).toBeVisible();
    await expect(page.getByTestId('notifications-popover')).toContainText('Notification 1');
  });
});
