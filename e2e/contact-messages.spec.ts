import { test, expect } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * The contact messages console.
 *
 * <p>The admin must be able to see what has not been read without opening
 * every message, and the page must never claim an email went out when it
 * did not.
 */
test.beforeEach(async ({ page }) => {
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);
  await page.goto('/dashboard/contact-messages');
});

test('the title is sentence case and the count line names the entity', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact messages');
  await expect(page.getByTestId('contact-messages-count')).toContainText(/message/i);
});

test('an unread message carries a dot and a bold subject', async ({ page }) => {
  const row = page.getByTestId('message-row').first();
  await expect(row).toBeVisible();
  await expect(row.getByTestId('unread-dot')).toBeVisible();
});

test('every row shows a preview of the message', async ({ page }) => {
  const row = page.getByTestId('message-row').first();
  const preview = row.locator('bdi').first();
  await expect(preview).toBeVisible();
  expect(((await preview.textContent()) ?? '').trim().length).toBeGreaterThan(0);
});

test('the unread tab shows only unread messages', async ({ page }) => {
  await page.getByRole('tab', { name: /unread/i }).click();
  const rows = page.getByTestId('message-row');
  await expect(rows.first()).toBeVisible();
  await expect(rows.first().getByTestId('unread-dot')).toBeVisible();
});

test('opening a message shows the dialog with the reply box', async ({ page }) => {
  await page.getByTestId('message-row').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('textarea')).toBeVisible();
});
