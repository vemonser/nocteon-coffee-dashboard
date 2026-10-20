/**
 * First-load table skeleton (user ticket 2, 2026-10-18):
 *
 * UC-S1  While the backend is answering, the categories table shows STUB
 *        ROWS in the table's own shape — no "No categories yet" flash, no
 *        blank table, `aria-busy` on the tbody. When the response lands the
 *        real rows replace the stubs.
 * UC-S2  When the backend DOES answer empty, the empty state appears AFTER
 *        loading — not during.
 *
 * Route interception controls the timing of the list endpoint, so these are
 * deterministic against the live stack.
 */
import { expect, test } from '@playwright/test';

import {
  creds,
  fillLoginForm,
  gotoLogin,
  submitLogin,
} from './helpers/auth';

test.describe.configure({ mode: 'serial' });

let page: import('@playwright/test').Page;
const LIST_API = '**/api/dashboard/categories**';
const EMPTY_PAGE = {
  success: true,
  message: 'OK',
  errors: null,
  data: {
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  },
};

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);
});

test.afterAll(async () => {
  await page.close();
});

/** Delay the list response by `ms`, or answer an empty page. */
async function gateCategoriesUrl(mode: 'delay' | 'empty', ms = 1500): Promise<void> {
  await page.route(LIST_API, async (route) => {
    if (mode === 'empty') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_PAGE) });
      return;
    }
    await new Promise((r) => setTimeout(r, ms));
    const response = await route.fetch();
    await route.fulfill({ response });
  });
}

test('UC-S1: skeleton rows while loading — no empty-state flash — then data', async () => {
  gateCategoriesUrl('delay');
  await page.goto('/dashboard/categories');

  // While the request is pending: real header + stub rows, NOT the empty state.
  await expect(page.locator('table thead th').first()).toBeVisible();
  const skeletonRows = page.locator('table tbody tr[aria-hidden="true"]');
  await expect(
    skeletonRows,
    'no skeleton rows rendered while the backend had not answered',
  ).toHaveCount(7);
  await expect(
    page.locator('table tbody').first(),
    'tbody must announce aria-busy while loading',
  ).toHaveAttribute('aria-busy', 'true');
  await expect(
    page.getByText(/No categories yet|لا توجد/).first(),
    'the empty state must NOT appear while loading',
  ).toHaveCount(0);

  await page.waitForTimeout(1800);

  // The response landed: real rows replaced the stubs, aria-busy cleared.
  // (Verify against the SEED data that always exists: the Coffee category.)
  await expect(page.locator('table tbody tr[aria-hidden="true"]')).toHaveCount(0);
  await expect(
    page.locator('table tbody tr').filter({ hasText: /Coffee|القهوة/ }).first(),
  ).toBeVisible();
  await expect(page.locator('table tbody').first()).not.toHaveAttribute('aria-busy');

  await page.unroute(LIST_API);
});

test('UC-S2: backend answers empty → the real empty state (after loading)', async () => {
  gateCategoriesUrl('empty');
  await page.goto('/dashboard/categories');

  // While pending (tiny window — the fulfill is immediate, so we cannot assert
  // the skeleton; see UC-S1 for that). Wait for the settled empty state.
  await expect(
    page.getByText(/No categories yet|لا توجد/).first(),
    'an genuinely-empty answer must show the empty state',
  ).toBeVisible({ timeout: 8000 });
  await expect(page.locator('table tbody tr[aria-hidden="true"]')).toHaveCount(0);

  await page.unroute(LIST_API);
});

test('UC-S3: skeleton never shows again once rows are on screen (reload keeps rows)', async () => {
  await page.goto('/dashboard/categories');
  await expect(page.locator('table tbody tr').filter({ hasText: /Coffee|القهوة/ }).first()).toBeVisible();

  // A second load (e.g. via the Active tab toggle) must NOT blank the table:
  // the in-place rows stay and the overlay handles refresh feedback.
  gateCategoriesUrl('delay', 1200);
  await page.getByRole('tab', { name: /Trash|المهملات/ }).click();
  await page.waitForTimeout(300);
  const rowsDuringToggle = await page.locator('table tbody tr').count();
  expect(rowsDuringToggle, 'rows must stay on screen during a reload').toBeGreaterThan(0);
  await page.waitForTimeout(1500);

  // Back to Active — data still there, no skeleton.
  await page.getByRole('tab', { name: /Active|الحالية/ }).click();
  await expect(
    page.locator('table tbody tr').filter({ hasText: /Coffee|القهوة/ }).first(),
  ).toBeVisible();
  expect(await page.locator('table tbody tr[aria-hidden="true"]').count(), 'skeleton rows leaked into a settled table').toBe(0);

  await page.unroute(LIST_API);
});
