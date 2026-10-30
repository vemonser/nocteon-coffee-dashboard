import { expect, test, type Page } from '@playwright/test';
import { cleanupCreated, recordCreated, testName } from './helpers/test-data';

/**
 * P1 — the catalog CRUD pages (pairings and the seven coffee-data lists).
 *
 * Pins the shared contract the pages now share through one dialog component:
 * one wording for the list button, the dialog title and the create action; a
 * named primary action on edit; the empty image placeholder; the bilingual
 * fields (Arabic RTL) with counters; Escape; the dirty-close question; the
 * row kebab menu; the exact trash count; and a real deletion date.
 *
 * ONE test on purpose: the dev backend rate-limits `/api/auth/login` and the
 * refresh cookie rotates, so every fresh page has to log in again. Keeping the
 * flow in one test signs in once.
 */

const EMAIL = process.env['E2E_ADMIN_EMAIL']!;
const PASSWORD = process.env['E2E_ADMIN_PASSWORD']!;
const API = (process.env['E2E_API_URL'] ?? 'http://localhost:8080').replace(/\/+$/, '');

test.use({ viewport: { width: 1440, height: 900 } });

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#identifier').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.waitForTimeout(800);
}

const PAGES = [
  { path: '/dashboard/pairings', add: 'Add pairing', testId: 'pairing-dialog' },
  { path: '/dashboard/origins', add: 'Add origin', testId: 'origin-dialog' },
  { path: '/dashboard/farms', add: 'Add farm', testId: 'farm-dialog' },
  { path: '/dashboard/roast-levels', add: 'Add roast level', testId: 'roast-level-dialog' },
  { path: '/dashboard/processing-methods', add: 'Add processing method', testId: 'processing-method-dialog' },
  { path: '/dashboard/coffee-varieties', add: 'Add coffee variety', testId: 'coffee-variety-dialog' },
  { path: '/dashboard/tasting-notes', add: 'Add tasting note', testId: 'tasting-note-dialog' },
  { path: '/dashboard/brewing-methods', add: 'Add brewing method', testId: 'brewing-method-dialog' },
] as const;

test('P1 catalog lists: one dialog, one action wording, exact trash count', async ({
  page,
  request,
}) => {
  await login(page);

  await test.step('list button, dialog title and create action share one wording', async () => {
    for (const target of PAGES) {
      await page.goto(target.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const addButton = page.locator('main button').filter({ hasText: target.add }).first();
      await expect(addButton).toHaveText(target.add);
      await addButton.click();

      const dialog = page.locator(`[data-testid="${target.testId}"]`);
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(target.add);
      await expect(dialog.locator('button[type="submit"]')).toHaveText(target.add);

      // Arabic field is RTL; both name fields carry a live counter and a limit.
      await expect(dialog.locator('input[formcontrolname="name"]')).toHaveCount(2);
      await expect(dialog.locator('input[formcontrolname="name"]').nth(1)).toHaveAttribute('dir', 'rtl');
      await expect(dialog.locator('input[formcontrolname="name"]').first()).toHaveAttribute('maxlength', '100');
      await expect(dialog.getByText('0/100').first()).toBeVisible();

      // Create mode never shows a leftover thumbnail.
      await expect(dialog.locator('app-image-upload img')).toHaveCount(0);

      // Escape closes a pristine dialog.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
  });

  await test.step('edit names the save action and a dirty dialog asks first', async () => {
    await page.goto('/dashboard/pairings');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.locator('main tbody tr').first().locator('button[aria-label="Actions"]').click();
    const menu = page.locator('[role="menu"]').last();
    await expect(menu.locator('button')).toHaveText(['Edit', 'Move to trash']);
    await menu.locator('button').filter({ hasText: 'Edit' }).click();

    const dialog = page.locator('[data-testid="pairing-dialog"]');
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Edit pairing');
    await expect(dialog.locator('button[type="submit"]')).toHaveText('Save changes');

    await dialog.locator('input[formcontrolname="name"]').first().fill('Renamed pairing');
    await page.keyboard.press('Escape');

    const confirm = page.locator('app-confirm-dialog [role="dialog"]');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('Discard changes?');
    await confirm.getByRole('button', { name: 'Keep editing' }).click();
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await confirm.getByRole('button', { name: 'Discard changes' }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('trash badge reports the exact count and rows show the deletion time', async () => {
    const loginResponse = await request.post(`${API}/api/auth/login`, {
      data: { identifier: EMAIL, password: PASSWORD },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const token = (await loginResponse.json()).data.accessToken as string;
    const headers = { Authorization: `Bearer ${token}` };

    for (let i = 1; i <= 12; i++) {
      const name = testName(`pairing-badge-${i}`);
      const response = await request.post(`${API}/api/dashboard/pairings`, {
        headers,
        multipart: {
          data: {
            name: 'data',
            mimeType: 'application/json',
            buffer: Buffer.from(
              JSON.stringify({
                translations: [
                  { language: 'en', name },
                  { language: 'ar', name: `إقران ${i}` },
                ],
              }),
            ),
          },
        },
      });
      expect(response.ok(), `create ${name}`).toBeTruthy();
      const data = (await response.json()).data;
      recordCreated({ entity: 'pairings', id: data.id, slug: data.slug, name });

      const trashed = await request.delete(`${API}/api/dashboard/pairings/${data.slug}`, { headers });
      expect(trashed.status(), `trash ${name}`).toBe(204);
    }

    await page.goto('/dashboard/pairings');
    const trashTab = page.getByRole('tab', { name: /Trash/ });
    // The real count, not the old "9+" cap.
    await expect(trashTab).toContainText('12');

    await trashTab.click();
    await expect(page.locator('main tbody tr').first()).toBeVisible();
    const deletedCell = page.locator('main tbody tr').first().locator('td[data-column="deleted"]');
    // The column formats `deletedAt` through the shared date-time formatter.
    // The deleted-list DTOs do not send `deletedAt` yet (DECISIONS.md, Needs
    // backend), so the honest fallback is shown until they do.
    await expect(deletedCell).toHaveText(/\d{1,2} \w+ \d{4}, \d{1,2}:\d{2}|Not recorded/);
    await expect(deletedCell.locator('time')).toHaveAttribute('title', /.+/);

    await page.screenshot({ path: 'evidence/pages/pass1/p1-trash-count-light-en.png' });

    await cleanupCreated();
  });
});
