import { expect, test, type Page } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';

/**
 * Create-category UX ticket:
 *  1. Silent-submit fixed — an invalid form (empty names) now shows an inline
 *     "fix errors" alert above the submit button + untouched-field errors.
 *  2. Backend validation errors render inline in the dialog (not only toast).
 *  3. Happy path completes: POST → dialog closes → detail page + toast.
 * (Duplicate-name check intentionally lives in the BACKEND — the client-side
 * guard added earlier was REVERTED by user request.)
 * Also cleans up the probe duplicate `coffee-3` created while investigating.
 */

let page: Page;

async function login() {  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);
  await page.goto('/dashboard/categories');
  await expect(page.locator('table tbody tr').first()).toBeVisible();
}

const dialog = () => page.getByRole('dialog');
const nameInputs = () => dialog().getByLabel(/Name|الاسم/);
const save = () => dialog().getByRole('button', { name: /Create category|إنشاء فئة/ });
const inlineAlert = () => dialog().locator('[role="alert"]');
const close = () => dialog().getByRole('button', { name: /Close|إغلاق/ });

test.beforeEach(async ({ browser }) => {
  page = await browser.newPage();
  await login();
});

test.afterEach(async () => {
  await page.close();
});

test('cleanup: trash probe/cooldown duplicates from earlier runs', async () => {
  for (const marker of ['coffee-3', 'e2e-create-ux-cat']) {
    const dupRow = page.locator('tbody tr').filter({ hasText: marker });
    if ((await dupRow.count()) === 0) continue; // already cleaned
    await dupRow.first().getByRole('button', { name: /Move to trash|نقل إلى المهملات/ }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: /Move to trash|نقل إلى المهملات/ }).click();
    await expect(dupRow).toHaveCount(0, { timeout: 8000 });
  }
});

test('empty names → inline fix-errors alert, field errors, no POST', async () => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/api/dashboard/categories')) posts.push(r.url());
  });

  await page.getByRole('button', { name: /Add category|إضافة فئة/ }).click();
  await expect(dialog()).toBeVisible();

  await save().click();
  await page.waitForTimeout(800);

  // Inline alert above the buttons + the field-level errors
  await expect(inlineAlert().filter({ hasText: /fix the highlighted|صحّح الحقول/ })).toBeVisible();
  await expect(dialog().getByText(/Name is required|الاسم مطلوب/).first()).toBeVisible();
  expect(posts).toHaveLength(0);
  expect(await dialog().isVisible()).toBe(true);
});

test('backend 400 → backend message shown inline in the dialog', async () => {
  await page.route(
    (url) => url.pathname.endsWith('/api/dashboard/categories'),
    async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Slug already exists on server', data: null, errors: null }),
      });
    },
  );

  await page.getByRole('button', { name: /Add category|إضافة فئة/ }).click();
  await expect(dialog()).toBeVisible();

  await nameInputs().nth(0).fill('Backend reject cat');
  await nameInputs().nth(1).fill('فئة مرفوضة من الخادم');

  await save().click();
  await page.waitForTimeout(1000);

  await expect(inlineAlert().filter({ hasText: 'Slug already exists on server' })).toBeVisible();
  expect(await dialog().isVisible()).toBe(true);
  await close().click();
});

test('happy path → POST 201, dialog closes, detail page opens + toast', async () => {
  const uniq = 'E2E create ux cat ' + Date.now();
  await page.getByRole('button', { name: /Add category|إضافة فئة/ }).click();
  await expect(dialog()).toBeVisible();

  await nameInputs().nth(0).fill(uniq);
  await nameInputs().nth(1).fill('فئة إنشاء تجريبية');

  const t0 = Date.now();
  await save().click();
  await page.waitForURL(/\/dashboard\/categories\//, { timeout: 15000 });
  const elapsed = Date.now() - t0;
  console.log('CREATE-TIMING click→detail ms =', elapsed);

  await expect(dialog()).toHaveCount(0);
  // brn-sonner-toast lingers hidden after dismiss — assert text, not visibility
  await expect(page.locator('brn-sonner-toast').first()).toContainText(/created/i, { timeout: 8000 });
  console.log('TOAST =', await page.locator('brn-sonner-toast').first().innerText());

  // Cleanup: trash what we just created
  await page.goto('/dashboard/categories');
  await expect(page.locator('table tbody tr').first()).toBeVisible();
  const row = page.locator('tbody tr').filter({ hasText: 'e2e-create-ux-cat' });
  await row.first().getByRole('button', { name: /Move to trash|نقل إلى المهملات/ }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: /Move to trash|نقل إلى المهملات/ }).click();
  await expect(row).toHaveCount(0, { timeout: 8000 });
});
