import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import { cleanupCreated, recordCreated, testName } from './helpers/test-data';

/**
 * wizard-fixes — the Add product wizard's contract.
 *
 *  W1/W8  the breadcrumb is a translated label ("Add product"), never a route key
 *  W2/W8  only the footer owns Back / Save changes
 *  W3/W8  a pristine load is never red; Next marks the current step only
 *  W5/W8  the story editor's toolbar is labelled, aligned and 240px tall;
 *         the description starts at four rows
 *  W6     variants: upper-case SKU, the 2/3/2 grid at 1024, "No stock yet" on a
 *         brand-new variant, options follow the product type
 *  W8     a complete product is created through the wizard
 */

async function login(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await gotoLogin(page);
    await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
    const result = await submitLogin(page);
    if (result.status === 429) {
      await page.waitForTimeout(20_000);
      continue;
    }
    expect(result.role, 'this suite requires an ADMIN account').toBe('ADMIN');
    return;
  }
  throw new Error('login stayed rate-limited (429) after 4 attempts');
}

/** Open the wizard and wait until the first step rendered. */
async function openWizard(page: Page, lang: 'en' | 'ar' = 'en'): Promise<void> {
  await page.goto('/dashboard/products/new', { waitUntil: 'domcontentloaded' });
  await page.evaluate((l) => {
    localStorage.setItem('language', l);
    // A half-filled form from an earlier test must not raise "Restore draft?"
    // in the middle of this one.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('products.wizard.draft.v1:')) localStorage.removeItem(key);
    }
  }, lang);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tablist', { name: /Product wizard steps/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('quill-editor .ql-editor').first()).toBeVisible({ timeout: 30_000 });
}

/** The step tab whose label contains the given text. */
function stepTab(page: Page, label: RegExp) {
  return page
    .getByRole('tablist', { name: /Product wizard steps/ })
    .getByRole('tab', { name: label });
}

/** Pick a value from the nth hlm-select on the page. */
async function pickSelect(page: Page, index: number, option: RegExp): Promise<void> {
  const trigger = page.getByRole('combobox').nth(index);
  await trigger.click();
  await page.getByRole('option', { name: option }).first().click();
  await page.waitForTimeout(250);
}

/** Pick the first real option of the nth hlm-select (its placeholder is not one). */
async function pickFirstOption(page: Page, index: number): Promise<void> {
  await page.getByRole('combobox').nth(index).click();
  await page.getByRole('option').first().click();
  await page.waitForTimeout(250);
}

const footer = (page: Page) => page.locator('[data-testid="wizard-footer"]');

test.describe('product wizard fixes (wizard-fixes)', () => {
  test.setTimeout(180_000);

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await cleanupCreated();
    await context?.close();
  });

  // ── W1 / W8 ────────────────────────────────────────────────────────────────
  test('the breadcrumb reads "Add product", not the route key', async () => {
    await openWizard(page);
    const crumb = page.locator('app-breadcrumb');
    await expect(crumb).toContainText('Add product');
    await expect(crumb).not.toContainText('newProduct');
    // No route key or unresolved placeholder anywhere in the trail.
    const trail = (await crumb.innerText()).trim();
    expect(trail).not.toMatch(/newProduct|editProduct|[a-z][A-Z][a-zA-Z]*/);
  });

  // ── W3 / W8 ────────────────────────────────────────────────────────────────
  test('a pristine load shows no red indicator; Next marks the current step only', async () => {
    await openWizard(page);

    const errorIcons = page.getByRole('img', { name: /^Has errors$/ });
    await expect(errorIcons).toHaveCount(0);

    // Language segments: neutral dots, no red, no green check yet.
    const segmentBar = page.getByRole('tablist', { name: 'Content' });
    await expect(segmentBar.getByRole('img', { name: /Required field missing/ })).toHaveCount(0);
    await expect(segmentBar.getByRole('img', { name: /^Complete$/ })).toHaveCount(0);

    // Next with an empty Basic info step: it stays red, Variants does not.
    await footer(page).getByRole('button', { name: /^Next$/ }).click();
    await expect(errorIcons).toHaveCount(1);
    await expect(stepTab(page, /^Basic info/).getByRole('img', { name: 'Has errors' })).toBeVisible();
    await expect(stepTab(page, /^Variants/).getByRole('img', { name: 'Has errors' })).toHaveCount(0);

    // It did not leave the step.
    await expect(stepTab(page, /^Basic info/)).toHaveAttribute('aria-selected', 'true');
  });

  // ── W2 / W8 ────────────────────────────────────────────────────────────────
  test('Back and Save changes exist only in the footer', async () => {
    await openWizard(page);

    // Walk every step and count the offending buttons OUTSIDE the footer.
    for (const tab of [/^Basic info/, /^Variants/, /^Media/]) {
      await stepTab(page, tab).click();
      await page.waitForTimeout(300);
      const outside = page.locator('button').filter({ hasText: /^(Back|Save changes)$/ });
      const count = await outside.count();
      for (let i = 0; i < count; i += 1) {
        const inFooter = await outside
          .nth(i)
          .evaluate((el) => !!el.closest('[data-testid="wizard-footer"]'));
        expect(
          inFooter,
          `"${(await outside.nth(i).innerText()).trim()}" lives outside the footer`,
        ).toBe(true);
      }
    }

    // The footer itself: Cancel on step 1, no Create before the last step.
    await stepTab(page, /^Basic info/).click();
    await expect(footer(page).getByRole('button', { name: /^Cancel$/ })).toBeVisible();
    await expect(footer(page).getByRole('button', { name: /^Create product$/ })).toHaveCount(0);
  });

  // ── W5 / W8 ────────────────────────────────────────────────────────────────
  test('story editor: labelled toolbar, aligned right edge, four-row description', async () => {
    await openWizard(page);

    const desc = page.locator('textarea[formcontrolname="description"]');
    await expect(desc).toHaveAttribute('rows', '4');
    expect(await desc.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(90);

    // Every toolbar control has an accessible name and a tooltip.
    const controls = page.locator('quill-editor .ql-toolbar button, quill-editor .ql-toolbar select');
    const total = await controls.count();
    expect(total).toBeGreaterThanOrEqual(11);
    for (let i = 0; i < total; i += 1) {
      const control = controls.nth(i);
      const aria = await control.getAttribute('aria-label');
      const title = await control.getAttribute('title');
      expect(aria, `toolbar control #${i} has an aria-label`).toBeTruthy();
      expect(title, `toolbar control #${i} has a tooltip`).toBeTruthy();
    }

    // The simplified toolbar: no font/size/colour/script/code/table/video/indent.
    const html = await page.locator('quill-editor .ql-toolbar').first().innerHTML();
    for (const banned of ['ql-font', 'ql-size', 'ql-color', 'ql-background', 'ql-script', 'ql-code', 'ql-table', 'ql-video', 'ql-indent', 'ql-align']) {
      expect(html, `the toolbar must not render ${banned}`).not.toContain(banned);
    }

    // Alignment: the editor's right edge equals a full-width field's right edge
    // (metaTitle sits in a two-column row, so description is the reference).
    const reference = page.locator('textarea[formcontrolname="description"]').first();
    const editor = page.locator('quill-editor .ql-editor').first();
    const delta = await Promise.all([
      reference.evaluate((el) => el.getBoundingClientRect().right),
      editor.evaluate((el) => el.getBoundingClientRect().right),
    ]).then(([field, story]) => Math.abs(field - story));
    expect(delta, 'story editor right edge vs field right edge').toBeLessThanOrEqual(1);

    // Minimum height and the live character counter.
    expect(await editor.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(240);
    await expect(page.getByText('0/2000')).toBeVisible();

    // The Arabic story edits right-to-left.
    await page.getByRole('tab', { name: /^العربي$/ }).click();
    await page.waitForTimeout(400);
    expect(
      await page.locator('quill-editor .ql-editor').first().evaluate((el) => getComputedStyle(el).direction),
    ).toBe('rtl');
  });

  // ── W6 ─────────────────────────────────────────────────────────────────────
  test('variants: upper-case SKU, the 2/3/2 grid, no-stock chip and type-scoped options', async () => {
    await openWizard(page);
    await stepTab(page, /^Variants/).click();
    await page.waitForTimeout(600);

    // No type yet: no option selects, the step asks for the type instead.
    await expect(page.locator('[data-testid="options-need-type"]')).toHaveCount(1);

    await footer(page).getByRole('button', { name: /^Back$/ }).click();
    await expect(stepTab(page, /^Basic info/)).toHaveAttribute('aria-selected', 'true');
    await pickSelect(page, 0, /^Coffee$/);

    await stepTab(page, /^Variants/).click();
    await page.waitForTimeout(1200);

    // Add the first variant.
    await page.getByRole('button', { name: /^Add variant$/ }).first().click();
    await page.waitForTimeout(400);

    const sku = page.locator('input[formcontrolname="sku"]').first();
    await expect(sku).toHaveAttribute('placeholder', 'e.g. AURUM-ETH-250');
    await sku.fill('e2e-aurum-eth-250');
    await sku.blur();
    await expect(sku).toHaveValue('E2E-AURUM-ETH-250');

    // A brand-new variant with stock 0 is neutral, not red.
    await expect(page.locator('[data-testid="variant-no-stock"]')).toHaveCount(1);
    await expect(page.getByText('Out of stock', { exact: true })).toHaveCount(0);

    // The option selects follow the type: Weight and Grind for coffee, no Size.
    const variantStepText = await page.locator('app-variants-step').innerText();
    expect(variantStepText).not.toMatch(/\bSize\b/i);
    await expect(page.locator('[data-testid="options-need-type"]')).toHaveCount(0);

    // The 2 / 3 / 2 grid at 1024px: no orphan cell in the last row.
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.waitForTimeout(300);
    const rows = await page
      .locator('input[formcontrolname="sku"]')
      .first()
      .evaluate(() => {
        const card = document.querySelector('input[formcontrolname="sku"]')?.closest('.grid') as HTMLElement | null;
        if (!card) return null;
        const fields = Array.from(
          card.querySelectorAll<HTMLElement>(
            'input[formcontrolname="sku"], input[formcontrolname="barcode"], input[formcontrolname="price"], input[formcontrolname="compareAtPrice"], input[formcontrolname="costPrice"], input[formcontrolname="stockQuantity"], input[formcontrolname="reorderThreshold"]',
          ),
        ).map((el) => ({
          name: el.getAttribute('formcontrolname'),
          top: Math.round(el.closest<HTMLElement>('.space-y-1\\.5')!.getBoundingClientRect().top),
        }));
        const byRow = new Map<number, string[]>();
        for (const field of fields) {
          byRow.set(field.top, [...(byRow.get(field.top) ?? []), field.name!]);
        }
        return {
          columns: getComputedStyle(card).gridTemplateColumns.split(' ').length,
          rows: [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([, names]) => names),
        };
      });
    expect(rows).not.toBeNull();
    expect(rows!.columns).toBe(6);
    expect(rows!.rows).toEqual([
      ['sku', 'barcode'],
      ['price', 'compareAtPrice', 'costPrice'],
      ['stockQuantity', 'reorderThreshold'],
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // ── W8: the whole flow ─────────────────────────────────────────────────────
  test('a complete product is created through the wizard', async () => {
    await openWizard(page);
    const name = testName('wizard-product');

    await pickSelect(page, 0, /^Coffee$/);
    await pickFirstOption(page, 1);

    // Names in both languages (the segment switches the visible group).
    await page.locator('input[formcontrolname="name"]').first().fill(`${name} EN`);
    await page.getByRole('tab', { name: /^العربي$/ }).click();
    await page.locator('input[formcontrolname="name"]').first().fill(`${name} AR`);

    // One variant with a price and stock, plus one option value.
    await stepTab(page, /^Variants/).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^Add variant$/ }).first().click();
    await page.waitForTimeout(300);
    await page.locator('input[formcontrolname="sku"]').first().fill(`E2E-${Date.now()}`);
    await page.locator('input[formcontrolname="price"]').first().fill('199.50');
    await page.locator('input[formcontrolname="stockQuantity"]').first().fill('12');
    // First option select inside the variant card (Weight for coffee).
    await page.waitForTimeout(1200);
    const variantSelects = page.locator('app-variants-step hlm-select');
    if ((await variantSelects.count()) > 0) {
      await variantSelects.first().getByRole('combobox').click();
      await page.getByRole('option').first().click();
      await page.waitForTimeout(300);
    }

    // Create only exists on the last visible step (Pairings for coffee).
    await stepTab(page, /^Pairings/).click();
    const create = footer(page).getByRole('button', { name: /^Create product$/ });
    await expect(create).toBeVisible();

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/dashboard/products') && r.request().method() === 'POST',
    );
    await create.click();
    const response = await responsePromise;
    expect([200, 201]).toContain(response.status());
    const body = (await response.json()) as { data?: { id?: number; slug?: string } };
    if (body.data?.id) {
      recordCreated({ entity: 'products', id: body.data.id, slug: body.data.slug, name });
    }

    await expect(page).toHaveURL(/\/dashboard\/products(\?.*)?$/, { timeout: 20_000 });
  });
});
