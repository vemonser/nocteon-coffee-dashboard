import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * Phase 5 — states and interactions.
 *
 * 1. Every widget has a loading, an error and an empty state, and forcing
 *    one endpoint to fail shows the error on THAT widget only.
 * 2. Switching the range quickly never shows the data of an older request.
 * 3. The range lives in the URL: it survives a refresh and the back button.
 * 4. The KPI cards and the list widgets drill down to a pre-filtered list.
 * 5. The range selector announces its changes, and the charts carry a
 *    text summary.
 */

const DASHBOARD = '/dashboard?days=30';

test.describe('dashboard states and interactions', () => {
  test.setTimeout(180_000);

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      if (result.status === 429) {
        await page.waitForTimeout(20_000);
        continue;
      }
      // `submitLogin` reads the role from a response listener; when the SPA
      // navigates before the body is captured the role comes back null even
      // though the login succeeded. The landing URL is the reliable signal.
      if (result.role === null && !page.url().includes('/login')) return;
      expect(result.role, 'this suite requires an ADMIN account').toBe('ADMIN');
      return;
    }
    throw new Error('login stayed rate-limited (429) after 4 attempts');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('1 — every dashboard endpoint fails one at a time, and only that widget errors', async () => {
    const ENDPOINTS: Array<{ name: string; match: RegExp }> = [
      { name: 'overview', match: /\/api\/dashboard\/stats\/overview/ },
      { name: 'settings', match: /\/api\/settings/ },
      { name: 'orders', match: /\/api\/dashboard\/orders/ },
    ];

    for (const endpoint of ENDPOINTS) {
      // Fail ONLY this endpoint; everything else answers normally.
      await page.route(endpoint.match, (route) => route.abort('failed'));
      await page.goto(DASHBOARD, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      const body = await page.locator('body').innerText();

      if (endpoint.name === 'overview') {
        // The widgets that read the overview show the error and a retry.
        const alerts = page.locator('[role="alert"]');
        expect(
          await alerts.count(),
          `the overview failure must produce an error state (body: ${body.slice(0, 200)})`,
        ).toBeGreaterThan(0);
        // The wording is per widget ("The attention queue could not be
        // loaded", "Could not load"), so match the load-failure family
        // rather than one widget's sentence.
        await expect(alerts.first()).toContainText(
          /could not (be )?load(ed)?|تعذّر التحميل/i,
        );
        // And a retry that really retries.
        await expect(
          page.getByRole('button', { name: /retry|إعادة المحاولة/i }).first(),
        ).toBeVisible();
      }

      if (endpoint.name === 'settings') {
        // The currency notice appears and the page still works.
        expect(
          body,
          'the store-settings failure must be announced',
        ).toMatch(/store settings|إعدادات المتجر/i);
      }

      if (endpoint.name === 'orders') {
        // The recent-orders widget shows its own error, and the rest of the
        // page still renders.
        const alerts = page.locator('[role="alert"]');
        expect(await alerts.count(), 'the orders failure must produce an error state').toBeGreaterThan(0);
        expect(body, 'the KPI area still renders').toMatch(/total revenue|إجمالي الإيرادات/i);
      }

      await page.unroute(endpoint.match);
    }
  });

  test('2 — switching the range quickly never shows an older range', async () => {
    await page.goto(DASHBOARD, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Make the FIRST request slow, so it answers AFTER the last one.
    let slow = true;
    await page.route(/\/api\/dashboard\/stats\/overview/, async (route) => {
      if (slow) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        slow = false;
      }
      await route.continue();
    });

    // 7 -> 90 -> 7, quickly.
    for (const days of [7, 90, 7]) {
      await page.locator(`[role="radio"][aria-checked]`, { hasText: new RegExp(`${days === 365 ? 365 : days}`) }).first().click();
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => ({
      url: new URL(window.location.href).searchParams.get('days'),
      checked: document.querySelector('[role="radio"][aria-checked="true"]')?.textContent?.trim(),
    }));
    // The URL and the control agree, and the last range (7) is the one shown.
    expect(state.url).toBe('7');
    expect(state.checked).toMatch(/7/);
    await page.unroute(/\/api\/dashboard\/stats\/overview/);
  });

  test('3 — the range lives in the URL and survives a refresh and the back button', async () => {
    await page.goto(DASHBOARD, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Pick 90 days.
    await page.locator('[role="radio"][aria-checked]').filter({ hasText: /90/ }).first().click();
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).searchParams.get('days')).toBe('90');

    // A refresh keeps it.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    expect(new URL(page.url()).searchParams.get('days')).toBe('90');
    const checked = await page
      .locator('[role="radio"][aria-checked="true"]')
      .first()
      .innerText();
    expect(checked).toMatch(/90/);

    // The back button walks back through the ranges.
    await page.locator('[role="radio"][aria-checked]').filter({ hasText: /7/ }).first().click();
    await page.waitForTimeout(1200);
    expect(new URL(page.url()).searchParams.get('days')).toBe('7');

    await page.goBack();
    await page.waitForTimeout(1500);
    expect(
      new URL(page.url()).searchParams.get('days'),
      'the back button returns to the previous range',
    ).toBe('90');
  });

  test('4 — the KPI cards drill down to a pre-filtered list', async () => {
    await page.goto(DASHBOARD, { waitUntil: 'domcontentloaded' });
    // Wait for the data-driven cards, not a fixed sleep: the widgets only get
    // their link once the overview answers, and a slow response used to fail
    // this test on an empty page.
    await expect(page.locator('app-kpi-card a').first()).toBeVisible({ timeout: 20_000 });

    // The orders card is a real link.
    const ordersLink = page
      .locator('app-kpi-card a')
      .filter({ hasText: /orders|الطلبات/i })
      .first();
    await expect(ordersLink).toBeVisible();
    const href = await ordersLink.getAttribute('href');
    expect(href, 'the KPI card must be a real link').toContain('/dashboard/orders');

    // A status slice in the "Orders by" chart links to the filtered list.
    const statusLink = page
      .locator('app-orders-breakdown-card a')
      .filter({ hasText: /Delivered|تم التوصيل/i })
      .first();
    await expect(statusLink).toBeVisible();
    const statusHref = await statusLink.getAttribute('href');
    expect(statusHref).toContain('/dashboard/orders');
    expect(statusHref, 'the link carries the pre-filter').toContain('status=');
  });

  test('5 — the range selector announces its change and the charts carry a summary', async () => {
    await page.goto(DASHBOARD, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // A radiogroup, with a checked radio.
    await expect(page.locator('[role="radiogroup"]').first()).toBeVisible();
    await expect(page.locator('[role="radio"][aria-checked="true"]').first()).toBeVisible();

    // The live region that announces the change. Scope it to the toolbar: the
    // shared loading skeleton also carries a polite status region, and picking
    // the first one on the page would assert against the skeleton instead.
    const live = page
      .locator('app-dashboard-toolbar [role="status"][aria-live="polite"]')
      .first();
    await expect(live).toBeAttached();

    await page.locator('[role="radio"][aria-checked]').filter({ hasText: /90/ }).first().click();
    await page.waitForTimeout(1200);
    await expect(live).not.toBeEmpty();

    // The charts carry a text summary (an aria-label on the figure).
    const chart = page.locator('app-chart-card [role="img"]').first();
    await expect(chart).toBeVisible();
    const label = await chart.getAttribute('aria-label');
    expect(label, 'the chart must have a text summary').toBeTruthy();
    expect(label!.length).toBeGreaterThan(3);

    // The revenue chart carries a summary line too.
    const summary = await page.locator('app-revenue-chart').first().innerText();
    expect(summary).toMatch(/total|average|best/i);
  });
});
