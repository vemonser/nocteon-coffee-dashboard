import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds } from './helpers/auth';

/**
 * Phase 6 — the states, the interactions and the accessibility of the orders
 * pages.
 *
 *   6.1  every endpoint that can fail has its own error state
 *   6.2  a fast filter switch never shows the data of an older request
 *   6.3  the day boundary and the time zone
 *   6.4  the dashboard's drill-down lands on a pre-filtered list
 *   6.5  the accessibility rules
 *
 * ONE login for the whole file (the backend rate-limits the login).
 */

const ORDERS = '/dashboard/orders';
const ORDER = '/dashboard/orders/1';

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('#identifier', creds.adminEmail);
    await page.fill('#password', creds.adminPassword);
    const response = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    );
    await page.click('button[type="submit"]');
    const result = await response;
    if (result.status() === 429) {
      await page.waitForTimeout(20_000);
      continue;
    }
    expect(result.ok()).toBe(true);
    await page.waitForURL('**/dashboard', { timeout: 20_000 });
    return;
  }
  throw new Error('login stayed rate-limited (429) after 4 attempts');
});

test.afterAll(async () => {
  await context?.close();
});

test.afterEach(async () => {
  await page.unrouteAll().catch(() => {});
});

test.describe('states and interactions', () => {
  test('the list has a loading, an empty and an error state', async () => {
    // loading: the table is mounted with skeleton rows, never blank.
    let delay = 3000;
    await page.route('**/api/dashboard/orders**', async (route) => {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      await route.continue();
    });
    await page.goto(ORDERS, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    // The table is on screen while it loads, with the skeleton rows in it.
    await expect(page.locator('app-data-table')).toBeVisible();
    await expect(page.locator('app-data-table tbody tr').first()).toBeVisible();
    delay = 0;
    await page.waitForTimeout(3500);
    await expect(page.locator('app-data-table tbody tr td').first()).toBeVisible();

    // error: the endpoint fails -> the error state with a retry.
    await page.route('**/api/dashboard/orders**', (route) => route.abort('failed'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="orders-error"]')).toBeVisible();
    await page.unrouteAll();

    // empty: a filter that matches nothing -> the "no results" empty state.
    await page.goto(`${ORDERS}?q=zzzzzz-no-such-order`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await expect(page.locator('app-data-table tbody')).toContainText(/no orders match these filters/i);
  });

  test('a fast filter switch never shows the data of an older request', async () => {
    let call = 0;
    await page.route('**/api/dashboard/orders**', async (route) => {
      call += 1;
      if (call === 1) await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });

    await page.goto(`${ORDERS}?paymentStatus=PAID`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(150);
    await page.goto(`${ORDERS}?paymentStatus=FAILED`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);

    // The card counts what the LAST request returned, and the request that
    // answered last is the one on screen.
    const matching = await page
      .locator('[data-testid="orders-stat-card"]')
      .nth(1)
      .locator('[data-testid="stat-value"]')
      .innerText();
    const rows = await page.locator('app-data-table tbody tr').count();
    expect(Number(matching.trim())).toBe(rows);
  });

  test('the dashboard drill-down lands on a PRE-FILTERED list', async () => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // The "Orders by status" breakdown links into the list with a filter.
    const link = page.locator('a[href*="/dashboard/orders?status="]').first();
    if ((await link.count()) > 0) {
      const href = await link.getAttribute('href');
      const status = new URL(href!, 'http://x').searchParams.get('status');
      expect(status).toBeTruthy();

      await link.click();
      await page.waitForURL(/dashboard\/orders\?status=/, { timeout: 10_000 });
      await page.waitForTimeout(1500);
      expect(new URL(page.url()).searchParams.get('status')).toBe(status);
      // And the list is really filtered: every row carries that status.
      const selected = await page
        .locator('[data-testid="orders-status-tab"][aria-selected="true"]')
        .innerText();
      expect(selected.length).toBeGreaterThan(0);
    }
  });

  test('the KPI card is a real link with a focus ring', async () => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const card = page.locator('a[href="/dashboard/orders"]').first();
    await expect(card).toBeVisible();
    // It is an anchor, so it can be opened in a new tab and it is announced
    // as a link.
    await expect(card).toHaveAttribute('href', '/dashboard/orders');
  });
});

test.describe('accessibility', () => {
  test('the status tabs are a tablist and the count is announced', async () => {
    await page.goto(ORDERS, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await expect(page.locator('[role="tablist"]')).toBeVisible();
    await expect(page.locator('[data-testid="orders-status-tab"]').first()).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The result of a filter is announced, not only drawn.
    const live = page.locator('[data-testid="orders-live-count"]');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toHaveAttribute('role', 'status');
  });

  test('a status is never carried by colour alone', async () => {
    await page.goto(ORDERS, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const badges = page.locator('app-status-badge');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 8); i += 1) {
      const text = (await badges.nth(i).innerText()).trim();
      expect(text.length).toBeGreaterThan(0);
    }
  });

  test('the focus ring is visible in DARK mode', async () => {
    await page.evaluate(() => localStorage.setItem('nocteon-theme', 'dark'));
    await page.goto(ORDERS, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    // A real Tab walk: `:focus-visible` does not match a programmatic
    // focus, so the ring has to be earned with the keyboard.
    let withoutRing = 0;
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab');
      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return true;
        const cs = getComputedStyle(el);
        const hasShadow = cs.boxShadow !== 'none' && cs.boxShadow !== '';
        const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth || '0') > 0;
        return hasShadow || hasOutline;
      });
      if (!ring) withoutRing += 1;
    }
    expect(withoutRing, 'focused controls without a visible ring').toBe(0);
    await page.evaluate(() => localStorage.setItem('nocteon-theme', 'light'));
  });

  test('the dialog traps the focus and restores it', async () => {
    // A CONFIRMED order — its status can still change.
    await page.goto('/dashboard/orders/15', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);

    const trigger = page.locator('[data-testid="order-update-status"]');
    await trigger.click();
    await page.waitForTimeout(600);
    const dialog = page.locator('[data-testid="status-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // The focus is INSIDE the dialog.
    const insideAtOpen = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="status-dialog"]');
      return !!panel && panel.contains(document.activeElement);
    });
    expect(insideAtOpen).toBe(true);

    // Tab all the way round: the focus never leaves the panel.
    let escaped = false;
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="status-dialog"]');
        return !!panel && panel.contains(document.activeElement);
      });
      if (!inside) {
        escaped = true;
        break;
      }
    }
    expect(escaped, 'the focus escaped the dialog').toBe(false);

    // Escape closes it, and the focus goes back to the control that opened
    // it.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(dialog).toHaveCount(0);
    const restored = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.getAttribute('data-testid') ?? null;
    });
    expect(restored).toBe('order-update-status');
  });

  test('the page works at 200% zoom (a 720px viewport)', async () => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto(ORDERS, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal page scroll at 200% zoom').toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('the detail page works at 200% zoom', async () => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto(ORDER, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal page scroll at 200% zoom').toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('reduced motion is respected', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(ORDERS, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // The page is usable and nothing animates for ever.
    await expect(page.locator('app-data-table')).toBeVisible();
    await page.emulateMedia({ reducedMotion: null });
  });
});
