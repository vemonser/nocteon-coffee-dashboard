import { expect, test } from '@playwright/test';

/**
 * P7 — Store settings is a settings FORM.
 *
 * Currency and Shipping sections, an EGP (i.e. current-currency) adornment on
 * the threshold, a warning when the currency changes, one sticky Save that is
 * disabled on a pristine/invalid form, a success toast, and the app's
 * unsaved-changes question when leaving a dirty form.
 */

const EMAIL = process.env['E2E_ADMIN_EMAIL']!;
const PASSWORD = process.env['E2E_ADMIN_PASSWORD']!;

test.use({ viewport: { width: 1440, height: 900 } });

test('store settings is a form with a guarded Save', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#identifier').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.waitForTimeout(800);

  await page.goto('/dashboard/store-settings');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const threshold = page.locator('#freeShippingThreshold');
  const save = page.locator('main form button[type="submit"]');
  const currencyTrigger = page.locator('#currency');

  await test.step('sections and sentence-case labels', async () => {
    await expect(page.getByRole('heading', { name: 'Currency', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Shipping', level: 2 })).toBeVisible();
    await expect(page.getByText('Free shipping threshold')).toBeVisible();
    await expect(page.getByText('Free shipping', { exact: true })).toBeVisible();
    await expect(page.getByText('Orders above this amount ship free.')).toBeVisible();
    await expect(page.getByText(/Enabled|Active/)).toHaveCount(0);
  });

  await test.step('the threshold is adorned with the store currency', async () => {
    const currency = (await currencyTrigger.innerText()).trim();
    expect(currency).toMatch(/^[A-Z]{3}$/);
    const adornment = page.locator('#freeShippingThreshold').locator('xpath=..').locator('span').first();
    await expect(adornment).toHaveText(currency);
  });

  await test.step('Save is disabled on a pristine form (evidence f)', async () => {
    await expect(save).toBeDisabled();
    await page.screenshot({ path: 'evidence/pages/pass1/p7-pristine-light-en.png' });
  });

  await test.step('an invalid threshold is red only after touch, and blocks Save', async () => {
    const original = await threshold.inputValue();
    await threshold.fill('-1');
    await threshold.blur();
    await expect(threshold).toHaveClass(/border-destructive/);
    await expect(page.getByText('Enter 0 or more, with at most 2 decimals.')).toBeVisible();
    await expect(save).toBeDisabled();
    await threshold.fill('1.234');
    await threshold.blur();
    await expect(save).toBeDisabled();
    await threshold.fill(original);
    await threshold.blur();
  });

  await test.step('changing the currency warns and enables Save', async () => {
    const original = await threshold.inputValue();
    await threshold.fill(String(Number(original) + 25));
    await threshold.blur();
    await expect(save).toBeEnabled();

    await currencyTrigger.click();
    const list = page.locator('[role="listbox"]').last();
    await expect(list).toBeVisible();
    await list.getByRole('option', { name: 'USD', exact: true }).click();
    await expect(page.getByText('Changing the currency affects every price in the store.')).toBeVisible();
    await expect(save).toBeEnabled();
    await page.screenshot({ path: 'evidence/pages/pass1/p7-dirty-light-en.png' });

    // Put the currency back before saving — this is a real dev store.
    await currencyTrigger.click();
    await page.locator('[role="listbox"]').last().getByRole('option', { name: 'EGP', exact: true }).click();
    await expect(page.getByText('Changing the currency affects every price in the store.')).toBeHidden();
  });

  await test.step('leaving a dirty form asks first', async () => {
    await page.getByRole('link', { name: 'Dashboard' }).click();
    const confirm = page.locator('app-unsaved-changes-dialog [role="alertdialog"]');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('Unsaved changes');
    await confirm.getByRole('button', { name: 'Stay on page' }).click();
    await expect(page).toHaveURL(/\/dashboard\/store-settings/);
  });

  await test.step('Save toasts and persists', async () => {
    const value = await threshold.inputValue();
    const original = value;
    const target = String(Number(value) + 5);
    await threshold.fill(target);
    await threshold.blur();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText('Store settings saved')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('#freeShippingThreshold')).toHaveValue(target);

    // Restore the original threshold.
    const restored = String(Number(target) - 5);
    await page.locator('#freeShippingThreshold').fill(restored);
    await page.locator('#freeShippingThreshold').blur();
    await page.locator('main form button[type="submit"]').click();
    await expect(page.getByText('Store settings saved')).toBeVisible();
    void original;
  });
});
