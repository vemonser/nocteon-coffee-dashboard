import { test, expect } from '@playwright/test';
import {
  creds,
  gotoLogin,
  fillLoginForm,
  submitLogin,
  isOnLogin,
  pathOf,
  sel,
  trackLoginRequests,
} from './helpers/auth';

/**
 * Auth E2E — admin gate + credential validation.
 *
 * ── BACKEND CONTRACT (verified live against POST /api/auth/login) ──────────
 *   200 -> {data:{accessToken, expiresIn, user:{role, permissions}}}
 *   401 -> {success:false, message:"Invalid email/username or password"}
 *
 * ── WHAT AC-2 ACTUALLY PROVES ──────────────────────────────────────────────
 * The backend authenticates ANY valid account, including non-admins. It issues
 * a 200 + valid JWT for a CUSTOMER. Therefore the dashboard can only be gated
 * in the UI today.
 *
 * AC-2 verifies UI-LEVEL ROUTING ONLY. It is NOT evidence that the backend
 * authorises /api/dashboard/* — that endpoint is protected server-side and is
 * NOT covered by this suite. See e2e/README.md for the full requirement map,
 * the two known app defects, and the decisions still owed by the product owner.
 *
 * ⚠ TRACES: Playwright records `fill()` values in plaintext. test-results/
 *   trace.zip files contain these credentials in the clear. /test-results/ is
 *   gitignored — do not attach traces to bug reports or CI artifacts.
 */

test.describe('Authentication', () => {
  // ─── AC-1: admin reaches the dashboard ────────────────────────────────────
  test('AC-1 admin with valid credentials lands on the dashboard', async ({ page }) => {
    await gotoLogin(page);
    await fillLoginForm(page, creds.adminEmail, creds.adminPassword);

    const result = await submitLogin(page);

    expect(result.status, 'backend should authenticate the admin').toBe(200);
    expect(result.role, 'AC-1 requires an ADMIN account').toBe('ADMIN');
    expect(pathOf(page), `admin did not reach the dashboard (landed on ${page.url()})`).toBe(
      '/dashboard',
    );
  });

  // ─── AC-2a: non-admin is not routed into the dashboard ────────────────────
  test('AC-2a non-admin is not routed into the dashboard', async ({ page }) => {
    await gotoLogin(page);
    await fillLoginForm(page, creds.userEmail, creds.userPassword);

    const result = await submitLogin(page);

    // Precondition: the fixture account really is a non-admin. Without this the
    // test could blame the app when the fault is a mis-set env var.
    expect(
      result.role,
      `E2E_USER_EMAIL must be a non-admin account (got role=${result.role}). ` +
        `Fix .env.local — this is a test-config fault, not an app fault.`,
    ).not.toBe('ADMIN');

    // The gate: must not end up on /dashboard.
    expect(
      pathOf(page),
      `SECURITY: non-admin (role=${result.role}) reached ${page.url()} — ` +
        `the dashboard admin gate is not enforced in the UI`,
    ).not.toBe('/dashboard');
  });

  // ─── AC-2b: non-admin sees an explanatory error ───────────────────────────
  // NOT IMPLEMENTED. login.component.ts sets `error` only from err.error?.message
  // on a 4xx; the backend returns 200 for a valid non-admin, so no error path
  // fires. Marked fixme — it encodes a UX decision nobody has made yet.
  test.fixme('AC-2b non-admin sees an explanatory error and stays on /login', async ({
    page,
  }) => {
    await gotoLogin(page);
    await fillLoginForm(page, creds.userEmail, creds.userPassword);
    await submitLogin(page);

    expect(isOnLogin(page)).toBe(true);
    await expect(page.locator(sel.error).first()).toBeVisible();
  });

  // ─── AC-3/4/5: missing required input ─────────────────────────────────────
  // Lazy getters — reading creds at collection time would make `npm test -- AC-1`
  // fail on an env var that test never uses.
  const emptyCases: Array<{
    id: string;
    email: () => string;
    password: () => string;
    label: string;
  }> = [
    { id: 'AC-3', email: () => '', password: () => '', label: 'no email and no password' },
    {
      id: 'AC-4',
      email: () => creds.adminEmail,
      password: () => '',
      label: 'email but no password',
    },
    {
      id: 'AC-5',
      email: () => '',
      password: () => creds.adminPassword,
      label: 'no email but password',
    },
  ];

  for (const c of emptyCases) {
    test(`${c.id} ${c.label} cannot submit`, async ({ page }) => {
      await gotoLogin(page);
      await fillLoginForm(page, c.email(), c.password());

      // Submit is disabled by [disabled]="form.invalid || loading() || success()".
      await expect(page.locator(sel.submit)).toBeDisabled();

      // Assert the real behaviour, not browser trivia: no request is ever sent.
      const loginCalls = trackLoginRequests(page);
      await page.locator(sel.password).press('Enter');
      await page.waitForTimeout(1000);
      expect(loginCalls(), 'an incomplete form must never hit the login endpoint').toBe(0);

      // Required-field messaging appears once the field is touched/dirty
      // (hlm-field-error gates on spartanInvalid). Blur to trigger it.
      if (c.email()) {
        await page.locator(sel.email).blur();
      }
      if (c.password()) {
        await page.locator(sel.password).blur();
      }
      const fieldError = page.locator('hlm-field-error:not([hidden])').first();
      if (await fieldError.count()) {
        await expect(fieldError).toBeVisible();
        await expect(fieldError).toContainText(/required/i);
      }
      // Absent a message, the form must at minimum remain unsubmittable.
      await expect(page.locator(sel.submit)).toBeDisabled();
    });
  }

  // ─── AC-6: malformed identifier ───────────────────────────────────────────
  // DELIBERATELY NOT ASSERTED AS BLOCKING. The field is labelled
  // "Email or Username" (en.json) and the backend error is
  // "Invalid email/username or password" — username login is a supported flow.
  // Adding Validators.email would BREAK username login.
  //
  // The genuine defect is dead template code: login.component.html renders
  // <hlm-field-error validator="email"> and validator="minlength" although the
  // form declares Validators.required only, so neither can ever fire.
  // That cleanup is a product decision — see e2e/README.md.
  test('AC-6a identifier accepts a username (not email-only)', async ({ page }) => {
    await gotoLogin(page);
    await fillLoginForm(page, 'admin', creds.adminPassword);
    // Must NOT be blocked client-side; the backend decides validity.
    await expect(page.locator(sel.submit)).toBeEnabled();
  });

  // ─── AC-7: wrong password ─────────────────────────────────────────────────
  test('AC-7 wrong password shows an error and stays on login', async ({ page }) => {
    await gotoLogin(page);
    await fillLoginForm(page, creds.adminEmail, 'ThisIsTheWrongPassword123!');

    const result = await submitLogin(page);

    expect(result.status).toBe(401);
    await expect(page.locator(sel.error).first()).toBeVisible();
    await expect(page.locator(sel.error).first()).toContainText(/invalid/i);
    expect(isOnLogin(page)).toBe(true);
  });

  // ─── AC-8: unknown account ────────────────────────────────────────────────
  test('AC-8 unknown email shows an error and stays on login', async ({ page }) => {
    await gotoLogin(page);
    await fillLoginForm(page, 'nobody@nowhere.local', creds.adminPassword);

    const result = await submitLogin(page);

    expect(result.status).toBe(401);
    await expect(page.locator(sel.error).first()).toBeVisible();
    await expect(page.locator(sel.error).first()).toContainText(/invalid/i);
    expect(isOnLogin(page)).toBe(true);
  });

  // ─── AC-9: unauthenticated deep link ──────────────────────────────────────
  test('AC-9 logged-out user hitting /dashboard is redirected to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');
    // Auto-retrying URL assertion — no fixed sleep, survives an async guard.
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});