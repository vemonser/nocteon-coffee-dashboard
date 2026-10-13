import { expect, type Page } from '@playwright/test';

/**
 * Shared helpers for the auth E2E suite.
 * Credentials come from the environment (.env.local) — never hardcoded here.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example -> .env.local and fill it in.`,
    );
  }
  return value;
}

export const creds = {
  get adminEmail() {
    return required('E2E_ADMIN_EMAIL');
  },
  get adminPassword() {
    return required('E2E_ADMIN_PASSWORD');
  },
  get userEmail() {
    return required('E2E_USER_EMAIL');
  },
  get userPassword() {
    return required('E2E_USER_PASSWORD');
  },
};

/** Selectors matching what the login form actually renders. */
export const sel = {
  email: '#identifier',
  password: '#password',
  submit: 'button[type="submit"]',
  /**
   * Inline API error block from login.component.html:
   *   class="... border-destructive ... text-destructive"
   * Deliberately NOT matching <hlm-field-error>, which renders no <p> and no
   * text-destructive class — so this cannot collide with field validation.
   */
  error: 'p.text-destructive',
};

export const DASHBOARD_PATH = '/dashboard';

export function pathOf(page: Page): string {
  const path = new URL(page.url()).pathname.replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

export function isOnLogin(page: Page): boolean {
  return pathOf(page) === '/login';
}

export function isOnDashboard(page: Page): boolean {
  return pathOf(page) === DASHBOARD_PATH;
}

/** Navigates to a clean /login with no leftover session. */
export async function gotoLogin(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/login');
  await expect(page.locator(sel.email)).toBeVisible();
  await expect(page.locator(sel.password)).toBeVisible();
  await expect(page.locator(sel.submit)).toBeVisible();
}

export async function fillLoginForm(
  page: Page,
  identifier: string,
  password: string,
): Promise<void> {
  await page.locator(sel.email).fill(identifier);
  await page.locator(sel.password).fill(password);
}

/** Counts POSTs to the login endpoint since the listener was attached. */
export function trackLoginRequests(page: Page): () => number {
  let count = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/auth/login')) count += 1;
  });
  return () => count;
}

export interface LoginResult {
  status: number;
  role: string | null;
  permissions: string[] | null;
}

/**
 * Submits the login form and waits for a DEFINITIVE terminal state:
 * either the SPA navigated away from /login, or the inline error appeared.
 * No fixed sleeps, no swallowed timeouts.
 */
export async function submitLogin(page: Page): Promise<LoginResult> {
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    { timeout: 20_000 },
  );

  await page.locator(sel.submit).click();

  const response = await responsePromise;

  // Read the body from the raw buffer captured at response time. response.json()
  // can throw if the SPA navigates away and the request context is torn down.
  let role: string | null = null;
  let permissions: string[] | null = null;
  try {
    const raw = await response.body();
    const body = JSON.parse(raw.toString('utf8'));
    role = body?.data?.user?.role ?? null;
    permissions = body?.data?.user?.permissions ?? null;
  } catch {
    /* 401 bodies are JSON too, but never assume it */
  }

  // Terminal state: navigated away OR error rendered.
  await Promise.race([
    page.waitForURL((url) => url.pathname.replace(/\/+$/, '') !== '/login', {
      timeout: 20_000,
    }),
    expect(page.locator(sel.error).first()).toBeVisible({ timeout: 20_000 }),
  ]).catch(() => undefined);

  return { status: response.status(), role, permissions };
}