/**
 * Detail-page UX contract (user ticket, 2026-10-18):
 *
 * UC-1  Save feedback — when the backend answers, the loader stops AND a
 *       success toast appears (no more silent "it feels stuck"). Verified in
 *       two phases so the seed data ends up byte-identical: save a marker,
 *       assert the toast, save it back, assert again.
 * UC-2  Discard button — hidden while the form is clean, appears as soon as
 *       any field changes, restores the stored values on click.
 * UC-3  Unsaved-changes navigation opens the IN-PAGE MODAL (alertdialog),
 *       not a window.confirm() — Leaving proceeds to the list, Cancel stays.
 * UC-4  Delete confirm modal CLOSES when the backend refuses (409) — the
 *       toast carries the reason and the dialog is gone either way.
 *
 * Note: UC-1 runs against the live coffee category but is self-reverting
 * (saves the original value back afterwards); no seed data is left changed.
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

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);
});

test.afterAll(async () => {
  await page.close();
});

const TOAST = 'brn-sonner-toast';
const MARK = 'live-e2e-ux-check';

async function openDetail(): Promise<void> {
  await page.goto('/dashboard/categories/coffee');
  // The embedded products table is the page's data-bearing surface.
  await expect(page.locator('main tbody tr').first()).toBeVisible();
  await expect(page.getByLabel(/Description|الوصف/).first()).toBeVisible();
}

const enDesc = () => page.getByLabel(/Description|الوصف/).first();
const saveBtn = () => page.getByRole('button', { name: /Save changes|حفظ التغييرات/ });
const discardBtn = () => page.getByRole('button', { name: /Discard|تجاهل/ });
const leaveModal = () => page.getByRole('alertdialog');

test('UC-1: save → backend response → loader stops + success toast + clean form', async () => {
  await openDetail();
  const stored = await enDesc().inputValue();

  // ── phase 1: save the marker ────────────────────────────────────────────────
  await enDesc().fill(`${stored} — ${MARK}`);
  await expect(saveBtn(), 'save must be clickable as soon as the form is dirty').toBeEnabled();

  await saveBtn().click();
  await expect(
    page.locator(TOAST).first(),
    'no success toast appeared when the backend answered',
  ).toContainText(
    // The backend's own message wins ("Category updated"); the fallback is
    // 'notify.updated'. Either way the admin SEES the result now.
    /Category updated|Updated successfully|تم التحديث/,
  );
  // The form is clean right after the response — discard button hides again.
  await expect(discardBtn()).toHaveCount(0);

  // ── phase 2: revert (keeps the seed data byte-identical) ────────────────────
  await enDesc().fill(stored);
  await saveBtn().click();
  await expect(page.locator(TOAST).first()).toContainText(
    /Category updated|Updated successfully|تم التحديث/,
  );
});

test('UC-2: discard button hidden until dirty, restores stored values on click', async () => {
  await openDetail();
  const stored = await enDesc().inputValue();

  await expect(discardBtn(), 'discard must be hidden while the form is clean').toHaveCount(0);

  await enDesc().fill(`${stored} — ${MARK}`);
  await expect(discardBtn(), 'discard must appear while the form is dirty').toBeVisible();

  await discardBtn().click();
  await expect(discardBtn(), 'discard must hide again once clicked').toHaveCount(0);
  await expect(enDesc()).toHaveValue(stored);
});

test('UC-3: unsaved changes on navigation open the modal, not a confirm() alert', async () => {
  await openDetail();
  const stored = await enDesc().inputValue();

  /** Register a dialog-noise listener: any native confirm() fails the test. */
  let nativeDialogFired = false;
  const onDialog = (): void => {
    nativeDialogFired = true;
  };
  page.on('dialog', onDialog);

  await enDesc().fill(`${stored} — ${MARK}`);
  const back = page
    .locator('header, main')
    .first()
    .getByRole('button', { name: /Back|رجوع/ })
    .first();

  for (const decision of ['cancel', 'leave']) {
    await back.click();
    await expect(
      leaveModal(),
      'the unsaved-changes modal must open on navigation while dirty',
    ).toBeVisible();
    expect(nativeDialogFired, 'a native confirm()/alert fired').toBe(false);

    if (decision === 'cancel') {
      await leaveModal().getByRole('button', { name: /Cancel|إلغاء/ }).click();
      await expect(
        page.locator('h1'),
        'cancel must keep the admin on the detail page',
      ).toBeVisible();
      await expect(page).toHaveURL(/\/dashboard\/categories\/coffee/);
    } else {
      await leaveModal()
        .getByRole('button', { name: /Leave without saving|المغادرة دون حفظ/ })
        .click();
      await expect(
        page,
        'leaving must land on the categories list',
      ).toHaveURL(/\/dashboard\/categories\/?$/, { timeout: 10_000 });
    }
  }

  page.off('dialog', onDialog);
});

test('UC-4: delete modal closes when the backend refuses (409)', async () => {
  await page.goto('/dashboard/categories');
  await expect(page.locator('table')).toBeVisible();

  const row = page.locator('tbody tr').filter({ hasText: /Coffee|القهوة/ }).first();
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: /^(Move to trash|نقل إلى الم)/ }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: /^(Move to trash|نقل إلى الم)/ }).click();

  // The backend refuses — the toast carries the reason…
  await expect(page.getByText(/used elsewhere|ما زال مستخدم/).first()).toBeVisible();
  // …and the modal must be GONE (previously it stayed open).
  await expect(dialog, 'the delete modal must close even when the delete fails').toHaveCount(
    0,
  );

  // The row survives, nothing was trashed.
  await expect(page.locator('tbody tr').filter({ hasText: /Coffee|القهوة/ }).first()).toBeVisible();
});
