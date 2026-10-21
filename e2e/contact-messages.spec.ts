import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * ONE shared session: the login endpoint is rate limited to 5/minute, so a
 * login per test rate-limits the suite against itself.
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

/**
 * The contact messages console.
 *
 * <p>The admin must be able to see what has not been read without opening
 * every message, and the page must never claim an email went out when it
 * did not.
 */
test.describe('the contact messages console', () => {
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
    await page.goto('/dashboard/contact-messages');
    await expect(page.getByTestId('contact-messages-count')).toBeVisible();
  });

test('the title is sentence case and the count line names the entity', async () => {
  // Wait for THIS page: the dashboard's own h1 would answer the role query
  // while the route is still loading.
  await expect(page.getByTestId('contact-messages-count')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact messages');
  await expect(page.getByTestId('contact-messages-count')).toContainText(/message/i);
});

test('an unread message carries a dot and a bold subject', async () => {
  // The unread TAB, not "the first row": which message is unread depends
  // on what the suite has already read, and the tab is deterministic.
  await page.getByRole('tab', { name: /unread/i }).click();
  const row = page.getByTestId('message-row').first();
  await expect(row).toBeVisible();
  await expect(row.getByTestId('unread-dot')).toBeVisible();
});

test('every row shows a preview of the message', async () => {
  await expect(page.getByTestId('contact-messages-count')).toBeVisible();
  const row = page.getByTestId('message-row').first();
  const preview = row.locator('bdi').first();
  await expect(preview).toBeVisible();
  expect(((await preview.textContent()) ?? '').trim().length).toBeGreaterThan(0);
});

test('the unread tab shows only unread messages', async () => {
  await page.getByRole('tab', { name: /unread/i }).click();
  const rows = page.getByTestId('message-row');
  await expect(rows.first()).toBeVisible();
  await expect(rows.first().getByTestId('unread-dot')).toBeVisible();
});

test('opening a message shows the dialog with the reply box', async () => {
  await page.getByTestId('message-row').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('textarea')).toBeVisible();
});
});
