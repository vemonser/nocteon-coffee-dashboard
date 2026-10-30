import { expect, test } from '@playwright/test';

/**
 * P4 — Product options: the "Add value" popover.
 *
 * It must open BELOW its trigger at the inline start, 8 px away, and only flip
 * above when there is no room; Escape closes it and returns focus to the
 * trigger; a required field turns red only after touch or submit; the option
 * code chip ("weight", "grind", "size") is monospace.
 */

const EMAIL = process.env['E2E_ADMIN_EMAIL']!;
const PASSWORD = process.env['E2E_ADMIN_PASSWORD']!;

test.use({ viewport: { width: 1440, height: 900 } });

test('add-value popover opens bottom-start, 8px below, and returns focus', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#identifier').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.waitForTimeout(800);

  await page.goto('/dashboard/product-options');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(800);

  // The option code chip is a machine identifier, so it is monospace.
  const chip = page.locator('main .font-mono').first();
  await expect(chip).toHaveText(/^\s*(weight|grind|size)\s*$/);
  const family = await chip.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family.toLowerCase()).toMatch(/mono/);

  // A card that already has values shows the add-value trigger under the chips.
  const trigger = page
    .locator('main button')
    .filter({ hasText: /Add value/ })
    .first();
  await expect(trigger).toBeVisible();
  const triggerBox = (await trigger.boundingBox())!;
  await trigger.click();

  const popover = page.locator('[role="dialog"]').filter({ has: page.locator('form') }).last();
  await expect(popover).toBeVisible();
  const box = (await popover.boundingBox())!;

  // Below the trigger, with the 8px offset, and left-aligned with it.
  expect(box.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height + 7);
  expect(Math.abs(box.x - triggerBox.x)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: 'evidence/pages/pass1/p4-popover-light-en.png' });

  // Required fields are not red before they are touched.
  const enInput = popover.locator('input[formcontrolname="en"]');
  await expect(enInput).not.toHaveAttribute('data-matches-spartan-invalid', 'true');
  await expect(popover.locator('button[type="submit"]')).toBeDisabled();

  // Touching (focus + blur) marks them, and only then are they red with a reason.
  await enInput.focus();
  await enInput.blur();
  await expect(enInput).toHaveAttribute('data-matches-spartan-invalid', 'true');
  await expect(popover.getByText('A value is required').first()).toBeVisible();

  // Escape closes and focus returns to the trigger.
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await expect(trigger).toBeFocused();
});
