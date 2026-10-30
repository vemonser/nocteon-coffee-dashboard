import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import { cleanupCreated, recordCreated, testName } from './helpers/test-data';

/**
 * W8 evidence capture: every step, at a 1440×900 VIEWPORT, in light-en,
 * dark-en and light-ar, for a coffee and an equipment product. Writes the
 * screenshots and `results.json` into evidence/wizard/pass1/.
 *
 * Viewport captures only: a full-page capture of a tall step shows fake
 * clipped text at fixed screen heights, which is a capture artifact, not a
 * rendering bug.
 */

const OUT = join(process.cwd(), 'evidence', 'wizard', 'pass1');

type Mode = { theme: 'light' | 'dark'; lang: 'en' | 'ar'; key: string };

const MODES: Mode[] = [
  { theme: 'light', lang: 'en', key: 'light-en' },
  { theme: 'dark', lang: 'en', key: 'dark-en' },
  { theme: 'light', lang: 'ar', key: 'light-ar' },
];

const STEPS = {
  coffee: ['basic', 'variants', 'media', 'tasting-notes', 'pairings'],
  equipment: ['basic', 'variants', 'media'],
} as const;

const STEP_LABEL: Record<'en' | 'ar', Record<string, RegExp>> = {
  en: {
    basic: /^Basic info/,
    variants: /^Variants/,
    media: /^Media/,
    'tasting-notes': /^Tasting notes/,
    pairings: /^Pairings/,
  },
  ar: {
    basic: /^المعلومات الأساسية/,
    variants: /^المتغيرات/,
    media: /^الوسائط/,
    'tasting-notes': /^ملاحظات التذوق/,
    pairings: /^التوائم/,
  },
};

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

async function openWizard(page: Page, mode: Mode): Promise<void> {
  await page.goto('/dashboard/products/new', { waitUntil: 'domcontentloaded' });
  await page.evaluate((m) => {
    localStorage.setItem('language', m.lang);
    localStorage.setItem('nocteon-theme', m.theme);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('products.wizard.draft.v1:')) localStorage.removeItem(key);
    }
  }, mode);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('tablist').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('quill-editor .ql-editor').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1200);
}

async function pickType(page: Page, mode: Mode, type: 'coffee' | 'equipment'): Promise<void> {
  const option = type === 'coffee' ? (mode.lang === 'ar' ? /^قهوة$/ : /^Coffee$/) : mode.lang === 'ar' ? /^معدات$/ : /^Equipment$/;
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: option }).first().click();
  await page.waitForTimeout(1500);
}

test.describe('wizard evidence (W8)', () => {
  test.setTimeout(300_000);

  let context: BrowserContext;
  let page: Page;
  const screenshots: Array<{ file: string; mode: string; productType: string; step: string }> = [];

  test.beforeAll(async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await cleanupCreated();
    await context?.close();
  });

  test('capture every step in the three modes and record the assertions', async () => {
    // ── Screenshots ────────────────────────────────────────────────────────
    // One wizard session per mode, switching the type inside it: six page
    // loads would fire the whole lookup set twice and hit the API's rate limit
    // (a "Too many requests" toast would land in the evidence).
    for (const mode of MODES) {
      await openWizard(page, mode);
      // Pristine: no red anywhere before the admin interacted (W3).
      if (mode.key === 'light-en') {
        const file = 'coffee-basic-pristine-light-en.png';
        await page.screenshot({ path: join(OUT, file) });
        screenshots.push({ file, mode: mode.key, productType: 'coffee', step: 'basic-pristine' });
      }
      await pickType(page, mode, 'coffee');
      for (const step of STEPS.coffee) {
        await page.getByRole('tablist').first().getByRole('tab', { name: STEP_LABEL[mode.lang][step] }).click();
        await page.waitForTimeout(700);
        const file = `coffee-${step}-${mode.key}.png`;
        await page.screenshot({ path: join(OUT, file) });
        screenshots.push({ file, mode: mode.key, productType: 'coffee', step });
      }

      // Equipment: same session, a different type.
      await page.getByRole('tablist').first().getByRole('tab', { name: STEP_LABEL[mode.lang].basic }).click();
      await page.waitForTimeout(300);
      await pickType(page, mode, 'equipment');
      for (const step of STEPS.equipment) {
        await page.getByRole('tablist').first().getByRole('tab', { name: STEP_LABEL[mode.lang][step] }).click();
        await page.waitForTimeout(700);
        const file = `equipment-${step}-${mode.key}.png`;
        await page.screenshot({ path: join(OUT, file) });
        screenshots.push({ file, mode: mode.key, productType: 'equipment', step });
      }
      await page.waitForTimeout(1000);
    }

    // ── Assertions (measured once, in light-en) ────────────────────────────
    await openWizard(page, MODES[0]);

    const breadcrumbText = (await page.locator('app-breadcrumb').innerText()).replace(/\s+/g, ' ').trim();
    const pristineRedIndicators = await page.getByRole('img', { name: /Has errors/ }).count();

    // Next with an empty step.
    await page.locator('[data-testid="wizard-footer"]').getByRole('button', { name: /^Next$/ }).click();
    await page.waitForTimeout(500);
    const redTabs = await page
      .getByRole('img', { name: /Has errors/ })
      .evaluateAll((nodes) => nodes.map((node) => node.closest('[role="tab"]')?.textContent?.trim() ?? ''));
    const activeTab = await page
      .getByRole('tab', { selected: true })
      .first()
      .innerText();

    // Buttons outside the footer.
    let buttonsOutsideFooter = 0;
    const offenders = page.locator('button').filter({ hasText: /^(Back|Save changes)$/ });
    for (let i = 0; i < (await offenders.count()); i += 1) {
      const inFooter = await offenders
        .nth(i)
        .evaluate((el) => !!el.closest('[data-testid="wizard-footer"]'));
      if (!inFooter) buttonsOutsideFooter += 1;
    }

    // Story editor contract.
    const toolbarControls = page.locator(
      'quill-editor .ql-toolbar button, quill-editor .ql-toolbar select, quill-editor .ql-toolbar .ql-picker-label',
    );
    let toolbarControlsWithoutLabel = 0;
    for (let i = 0; i < (await toolbarControls.count()); i += 1) {
      if (!(await toolbarControls.nth(i).getAttribute('aria-label'))) toolbarControlsWithoutLabel += 1;
    }
    const editor = page.locator('quill-editor .ql-editor').first();
    const [fieldRight, editorRight] = await Promise.all([
      page.locator('textarea[formcontrolname="description"]').evaluate((el) => el.getBoundingClientRect().right),
      editor.evaluate((el) => el.getBoundingClientRect().right),
    ]);
    const descriptionRows = await page.getAttribute('textarea[formcontrolname="description"]', 'rows');

    // Create sits on the last visible step only, and the flow completes.
    const createBeforeLast = await page.locator('[data-testid="wizard-footer"]').getByRole('button', { name: /^Create product$/ }).count();

    await pickType(page, MODES[0], 'coffee');
    const productName = testName('wizard-evidence');
    await page.locator('input[formcontrolname="name"]').first().fill(`${productName} EN`);
    await page.getByRole('tab', { name: /العربي/ }).click();
    await page.locator('input[formcontrolname="name"]').first().fill(`${productName} AR`);
    // The category list arrives with the page; retry if the popup was still empty.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.getByRole('combobox').nth(1).click();
      const option = page.getByRole('option').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        break;
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(400);

    await page.getByRole('tablist').first().getByRole('tab', { name: /^Variants$/ }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /^Add variant$/ }).first().click();
    await page.waitForTimeout(400);
    await page.locator('input[formcontrolname="sku"]').first().fill(`E2E-EVIDENCE-${Date.now()}`);
    await page.locator('input[formcontrolname="price"]').first().fill('150');
    await page.locator('input[formcontrolname="stockQuantity"]').first().fill('8');
    const variantSelect = page.locator('app-variants-step hlm-select').first();
    if ((await variantSelect.count()) > 0) {
      await variantSelect.getByRole('combobox').click();
      await page.getByRole('option').first().click();
      await page.waitForTimeout(300);
    }

    await page.getByRole('tablist').first().getByRole('tab', { name: /^Pairings$/ }).click();
    const createButton = page.locator('[data-testid="wizard-footer"]').getByRole('button', { name: /^Create product$/ });
    const createOnLastStep = await createButton.count();

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/dashboard/products') && r.request().method() === 'POST',
    );
    await createButton.click();
    const response = await responsePromise;
    const created = response.status();
    const body = (await response.json()) as { data?: { id?: number; slug?: string } };
    if (body.data?.id) {
      recordCreated({
        entity: 'products',
        id: body.data.id,
        slug: body.data.slug,
        name: productName,
      });
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, 'created-product-light-en.png') });
    screenshots.push({
      file: 'created-product-light-en.png',
      mode: 'light-en',
      productType: 'coffee',
      step: 'created',
    });

    const results = {
      generatedAt: new Date().toISOString(),
      baseUrl: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
      viewport: { width: 1440, height: 900 },
      capture: 'viewport only (never fullPage)',
      screenshots,
      assertions: {
        breadcrumbText,
        breadcrumbIsTranslated: breadcrumbText.includes('Add product') && !/newProduct/.test(breadcrumbText),
        pristineRedIndicators,
        nextWithMissingFields: {
          redTabs,
          activeTab,
          markedOnlyCurrentStep: redTabs.length === 1 && /Basic info/.test(redTabs[0] ?? ''),
        },
        buttonsNamedBackOrSaveChangesOutsideFooter: buttonsOutsideFooter,
        toolbarControlsWithoutAriaLabel: toolbarControlsWithoutLabel,
        storyEditorRightEdgeDeltaPx: Math.abs(fieldRight - editorRight),
        descriptionRows: Number(descriptionRows),
        createProductBeforeLastStep: createBeforeLast,
        createProductOnLastStep: createOnLastStep,
        createdProductHttpStatus: created,
        createdProductSlug: body.data?.slug ?? null,
        completeProductCreated: (created === 200 || created === 201) && /\/dashboard\/products(\?.*)?$/.test(page.url()),
      },
    };

    writeFileSync(join(OUT, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);

    // The contract itself, so a regression fails the capture run.
    expect(results.assertions.breadcrumbIsTranslated).toBe(true);
    expect(results.assertions.pristineRedIndicators).toBe(0);
    expect(results.assertions.nextWithMissingFields.markedOnlyCurrentStep).toBe(true);
    expect(results.assertions.buttonsNamedBackOrSaveChangesOutsideFooter).toBe(0);
    expect(results.assertions.toolbarControlsWithoutAriaLabel).toBe(0);
    expect(results.assertions.storyEditorRightEdgeDeltaPx).toBeLessThanOrEqual(1);
    expect(results.assertions.descriptionRows).toBeGreaterThanOrEqual(4);
    expect(results.assertions.createProductBeforeLastStep).toBe(0);
    expect(results.assertions.createProductOnLastStep).toBe(1);
    expect(results.assertions.completeProductCreated).toBe(true);
  });
});
