import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * W1 — language sync on the category detail page.
 *
 * Product names are localized by the backend at REQUEST time
 * (Accept-Language), so switching the UI language must refetch the
 * products. The breadcrumb's last crumb must stay the ENTITY's
 * current-language name ("Coffee" / "القهوة") — never fall back to the
 * static route-data label ("Category").
 *
 * AC-L1: in EN, product names + breadcrumb are English.
 * AC-L2: after switching to AR, product names + breadcrumb are Arabic
 *        (refetched, not stale EN strings).
 * AC-L3: switching back to EN restores the exact EN state.
 */

const ARABIC = /[\u0600-\u06FF]/;

test.describe('W1 detail language sync', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      if (result.status === 429) {
        await page.waitForTimeout(20_000);
        continue;
      }
      expect(result.role, 'the language-sync suite requires an ADMIN account').toBe('ADMIN');
      return;
    }
    throw new Error('login stayed rate-limited (429) after 3 attempts');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  /** First product row's name in the embedded products table, as rendered. */
  async function firstProductName(): Promise<string> {
    return (await page.locator('[data-testid="name-link"]').first().innerText()).trim();
  }

  /** Last breadcrumb crumb's label. */
  async function lastCrumb(): Promise<string> {
    return (await page.locator('nav[aria-label="breadcrumb"] li').last().innerText()).trim();
  }

  /** Open the topbar user menu and toggle the language via the real UI control. */
  async function toggleLanguage(): Promise<void> {
    await page.getByRole('main').getByRole('button', { name: /Account|الحساب الشخصي/ }).click();
    await page.getByRole('menuitem', { name: /Language|اللغة/ }).click();
  }

  /** Category title (the detail page's h1) — the entity's stored name. */
  async function h1Text(): Promise<string> {
    return (await page.getByRole('heading', { level: 1 }).innerText()).trim();
  }

  test('AC-L1/L2/L3: product names + breadcrumb follow EN → AR → EN', async () => {
    await page.goto('/dashboard/categories/coffee');
    // The embedded products table is the localized surface under test.
    await expect(page.locator('[data-testid="name-link"]').first()).toBeVisible();

    // ── EN ────────────────────────────────────────────────────────────────
    await expect.poll(firstProductName).not.toMatch(ARABIC);
    const nameEn = await firstProductName();
    expect(nameEn.length, 'EN product name must be present').toBeGreaterThan(0);
    // The breadcrumb must end with the ENTITY name (read live — the seed's
    // names are whatever the database holds, not fixed literals).
    const titleEn = await h1Text();
    await expect.poll(lastCrumb).toBe(titleEn);
    const crumbEn = await lastCrumb();
    expect(crumbEn, 'EN breadcrumb must be the entity name, not the route label').not.toMatch(
      /^Category$/,
    );

    // ── AR ────────────────────────────────────────────────────────────────
    await toggleLanguage();
    // The refetch is async — poll until the AR name renders.
    await expect.poll(firstProductName).toMatch(ARABIC);
    const nameAr = await firstProductName();
    expect(nameAr, 'AR product name must differ from the EN name').not.toBe(nameEn);
    // Table headers are UI chrome, not entity data: they must be TRANSLATED,
    // never a raw key and never a stray English literal. (The columns used to
    // carry Arabic literals as their header, which bypassed transloco.)
    const headerText = (await page.locator('main thead').innerText()).trim();
    expect(headerText, 'AR headers must be Arabic').toMatch(ARABIC);
    expect(headerText, 'AR headers must not leak raw keys').not.toMatch(/[a-z]+\.[a-z]+/i);
    // Same cycle: heading + last crumb are the AR (stored) entity name.
    const titleAr = await h1Text();
    expect(titleAr, 'AR heading must differ from EN').not.toBe(titleEn);
    expect(titleAr).toMatch(ARABIC);
    await expect.poll(lastCrumb).toBe(titleAr);

    // ── EN again ──────────────────────────────────────────────────────────
    await toggleLanguage();
    await expect.poll(firstProductName).toEqual(nameEn);
    await expect.poll(lastCrumb).toEqual(crumbEn);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(crumbEn);
  });
});
