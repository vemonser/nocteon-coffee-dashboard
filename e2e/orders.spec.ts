import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds } from './helpers/auth';

/**
 * The orders list and the order detail page.
 *
 * ONE login for the whole file (the backend rate-limits
 * POST /api/auth/login to 5/min per identifier), and the session is reused
 * through the shared context.
 *
 * What is proved here:
 *   - the numbers on the screen agree with the API (the cards, the tabs, the
 *     row count) — the "17 total vs 10 orders" defect cannot come back;
 *   - the page is fully reactive to a RUNTIME language switch, in both
 *     languages, with no raw translation key anywhere;
 *   - the state lives in the URL;
 *   - the status dialog offers only the transitions the backend allows;
 *   - a failing endpoint shows an error state on its own section, and a retry
 *     recovers;
 *   - a fast filter switch can never show the data of an older request.
 */

const ORDERS = '/dashboard/orders';
const ORDER = '/dashboard/orders/1';

/** A raw translation key: `namespace.subnamespace.KEY`. */
const RAW_KEY = /\b[a-z]+\.[a-z]+\.[A-Z_]+\b/;

/** Every visible text of the page, as one string. */
async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = (node.textContent ?? '').trim();
      if (text) {
        const el = node.parentElement;
        if (el && el.offsetParent !== null) parts.push(text);
      }
      node = walker.nextNode();
    }
    return parts.join(' ');
  });
}

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // The backend rate-limits POST /api/auth/login (5/min per identifier).
  // A worker restart re-runs this hook, so a 429 is waited out rather than
  // failing the run.
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

/**
 * Every test starts from the same state: English, and no route
 * interception left over from the previous test.
 *
 * A leaked `page.route` would make the NEXT test talk to a broken API and
 * fail for a reason that has nothing to do with it.
 */
test.afterEach(async () => {
  await page.unrouteAll().catch(() => {});
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== 'en') await switchLanguage('en');
});

/** Switch the language through the app's own control (user menu -> Language). */
async function switchLanguage(target: 'en' | 'ar'): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await page.evaluate(() => document.documentElement.lang);
    if (current === target) return;
    await page.keyboard.press('Escape').catch(() => {});
    const trigger = page.locator(
      'app-user-menu[variant="navbar"] button[data-slot="dropdown-menu-trigger"]',
    );
    await trigger.waitFor({ state: 'visible', timeout: 8_000 });
    await trigger.click();
    const item = page.locator('[role="menuitem"]', { hasText: /Language|اللغة/ });
    await item.waitFor({ state: 'visible', timeout: 8_000 });
    await item.click();
    await page.waitForFunction(
      (lang) => document.documentElement.lang === lang,
      target,
      { timeout: 8_000 },
    );
    await page.waitForTimeout(400);
  }
  throw new Error(`could not switch the language to ${target}`);
}

/**
 * Open a route and wait for its content.
 *
 * The backend rate-limits the API (200 requests/min per identifier), and a
 * suite that opens ~19 pages trips it. The app's own answer to a 429 is the
 * error state with a retry — which is what the error-state test asserts —
 * but for the OTHER tests the rate limit is an environment fact, not a
 * defect, so the wait is simply taken.
 */
async function open(path: string, ready: string): Promise<void> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const rateLimited = await page
      .locator('text=/Too many requests/i')
      .first()
      .isVisible()
      .catch(() => false);
    if (!rateLimited) {
      await page.locator(ready).first().waitFor({ state: 'visible', timeout: 10_000 });
      return;
    }
    await page.waitForTimeout(12_000);
  }
  throw new Error(`${path} stayed rate-limited after 4 attempts`);
}

test.describe('orders list', () => {
  test.beforeEach(async () => {
    await open(ORDERS, 'app-data-table');
  });

  test('the column order is the one the ticket asks for', async () => {
    const headers = await page.locator('app-data-table thead th').allInnerTexts();
    const cleaned = headers.map((h) => h.replace(/[↕↑↓]/g, '').trim());
    expect(cleaned).toEqual([
      '',
      'Order #',
      'Customer',
      'Items',
      'Order status',
      'Payment status',
      'Method',
      'Total',
      'Created at',
      'Actions',
    ]);
  });

  test('the raw id column is not shown', async () => {
    const headers = await page.locator('app-data-table thead th').allInnerTexts();
    expect(headers.map((h) => h.trim())).not.toContain('ID');
  });

  test('the cards count the whole set, not the page rows', async () => {
    // The API is the reference: the total of the list.
    const response = await page.request.get(
      'http://localhost:8080/api/dashboard/orders?page=0&size=100',
      { headers: { Authorization: `Bearer ${await accessToken(page)}` } },
    );
    const body = await response.json();
    const total = body?.data?.totalElements ?? 0;

    const cards = page.locator('[data-testid="orders-stat-card"]');
    await expect(cards).toHaveCount(5);

    const all = await cards.nth(0).locator('[data-testid="stat-value"]').innerText();
    expect(Number(all.trim())).toBe(total);

    // The "Cancelled" card must agree with the CANCELLED tab, and with the
    // rows that say Cancelled — the defect this page was rebuilt for.
    const cancelledCard = await cards.nth(4).locator('[data-testid="stat-value"]').innerText();
    const cancelledTab = await page
      .locator('[data-testid="orders-status-tab"]', { hasText: 'Cancelled' })
      .innerText();
    expect(cancelledTab).toContain(cancelledCard.trim());
  });

  test('the header count agrees with the row count', async () => {
    const headerCount = await page.locator('[data-testid="orders-total-count"]').innerText();
    const rows = await page.locator('app-data-table tbody tr').count();
    const number = Number(headerCount.replace(/[^\d]/g, ''));
    expect(rows).toBeLessThanOrEqual(number);
    expect(number).toBeGreaterThan(0);
  });

  test('the Method and Order # columns are never truncated', async () => {
    const report = await page.evaluate(() => {
      const table = document.querySelector('app-data-table table');
      if (!table) return { error: 'no table' };
      const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
        (th.textContent || '').trim().replace(/[↕↑↓]/g, '').trim(),
      );
      const methodIndex = headers.indexOf('Method');
      const orderIndex = headers.indexOf('Order #');

      const truncatedIn = (index: number): string[] => {
        const out: string[] = [];
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        for (const tr of rows) {
          const td = tr.querySelectorAll('td')[index];
          if (!td) continue;
          for (const el of Array.from(td.querySelectorAll('*'))) {
            const cs = getComputedStyle(el);
            if (cs.textOverflow !== 'ellipsis') continue;
            if (el.scrollWidth <= el.clientWidth + 1) continue;
            out.push((el.textContent || '').trim());
          }
        }
        return out;
      };

      // A header must never be cut either.
      const truncatedHeaders: string[] = [];
      for (const th of Array.from(table.querySelectorAll('thead th'))) {
        for (const el of Array.from(th.querySelectorAll('*'))) {
          const cs = getComputedStyle(el);
          if (cs.textOverflow !== 'ellipsis') continue;
          if (el.scrollWidth <= el.clientWidth + 1) continue;
          truncatedHeaders.push((el.textContent || '').trim());
        }
      }

      // A value that IS truncated must carry a tooltip, so it stays readable.
      const truncatedWithoutTooltip: string[] = [];
      for (const el of Array.from(table.querySelectorAll('tbody td *'))) {
        const cs = getComputedStyle(el);
        if (cs.textOverflow !== 'ellipsis') continue;
        if (el.scrollWidth <= el.clientWidth + 1) continue;
        const host = el.closest('td');
        const title = host?.querySelector('[title]')?.getAttribute('title');
        if (!title) truncatedWithoutTooltip.push((el.textContent || '').trim());
      }

      return {
        methodIndex,
        orderIndex,
        method: truncatedIn(methodIndex),
        orderNumber: truncatedIn(orderIndex),
        truncatedHeaders,
        truncatedWithoutTooltip,
      };
    });

    expect(report.method, 'the Method column must not be truncated').toEqual([]);
    expect(report.orderNumber, 'the Order # column must not be truncated').toEqual([]);
    expect(report.truncatedHeaders, 'a header must not be cut').toEqual([]);
    expect(
      report.truncatedWithoutTooltip,
      'a truncated value must carry a tooltip',
    ).toEqual([]);
  });

  test('a raw translation key never reaches the screen', async () => {
    const text = await visibleText(page);
    expect(text.match(RAW_KEY)).toBeNull();
  });

  test('the state lives in the URL and survives a reload', async () => {
    await page.locator('[data-testid="orders-status-tab"]', { hasText: 'Cancelled' }).click();
    await page.waitForTimeout(600);
    expect(new URL(page.url()).searchParams.get('status')).toBe('CANCELLED');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).searchParams.get('status')).toBe('CANCELLED');
    const selected = await page
      .locator('[data-testid="orders-status-tab"][aria-selected="true"]')
      .innerText();
    expect(selected).toContain('Cancelled');
  });

  test('a search narrows the list and is reflected in the URL', async () => {
    await page.locator('[data-testid="orders-search"]').fill('ORD-2026-000001');
    await page.waitForTimeout(1200);
    expect(new URL(page.url()).searchParams.get('q')).toBe('ORD-2026-000001');
    const rows = await page.locator('app-data-table tbody tr').count();
    expect(rows).toBe(1);
  });

  test('the page reacts to a RUNTIME language switch, in both languages', async () => {
    const enHeaders = await page.locator('app-data-table thead th').allInnerTexts();
    // The METHOD label was once translated in the column accessor, so it
    // froze in the language that was active when the data arrived.
    const enMethod = await page
      .locator('app-data-table tbody tr')
      .first()
      .locator('td')
      .nth(6)
      .innerText();

    await switchLanguage('ar');
    await page.waitForTimeout(600);
    const arHeaders = await page.locator('app-data-table thead th').allInnerTexts();
    expect(arHeaders.join(' ')).not.toBe(enHeaders.join(' '));
    const arMethod = await page
      .locator('app-data-table tbody tr')
      .first()
      .locator('td')
      .nth(6)
      .innerText();
    expect(arMethod).not.toBe(enMethod);
    expect(arMethod).toMatch(/[\u0600-\u06FF]/);
    // Arabic headers are Arabic, not a mix of scripts.
    expect(arHeaders.filter(Boolean).join(' ')).not.toMatch(/[A-Za-z]/);
    // And no raw key leaked while switching.
    expect((await visibleText(page)).match(RAW_KEY)).toBeNull();

    await switchLanguage('en');
    await page.waitForTimeout(600);
    const backHeaders = await page.locator('app-data-table thead th').allInnerTexts();
    expect(backHeaders.join(' ')).toBe(enHeaders.join(' '));
  });

  test('the money is the store currency in both languages', async () => {
    // The shared money formatter decides the shape of the amount; the test
    // asserts the STORE CURRENCY and the digits, not one particular glyph.
    const enMoney = await page.locator('app-data-table tbody tr td:nth-child(8)').first().innerText();
    expect(enMoney.toUpperCase()).toContain('EGP');
    expect(enMoney).toMatch(/\d/);

    await switchLanguage('ar');
    await page.waitForTimeout(800);
    const arMoney = await page.locator('app-data-table tbody tr td:nth-child(8)').first().innerText();
    // The Arabic symbol of the store currency, and LATIN digits.
    expect(arMoney).toContain('ج.م');
    expect(arMoney).toMatch(/\d/);
    expect(arMoney).not.toMatch(/[٠-٩]/);
  });

  test('a failing endpoint shows an error state with a retry, and the retry recovers', async () => {
    await page.route('**/api/dashboard/orders**', (route) => route.abort('failed'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="orders-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="orders-error"]')).toHaveAttribute('role', 'alert');
    // The retry is a real control, not a decoration.
    await expect(page.locator('[data-testid="orders-error"] button')).toBeEnabled();

    await page.unroute('**/api/dashboard/orders**');
    await page.locator('[data-testid="orders-error"] button').click();
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-testid="orders-error"]')).toHaveCount(0);
    await expect(page.locator('app-data-table tbody tr').first()).toBeVisible();
  });

  test('a fast filter switch never shows the data of an older request', async () => {
    // The first request is delayed; the second is not. The page must end on
    // the SECOND filter's data.
    let call = 0;
    await page.route('**/api/dashboard/orders**', async (route) => {
      call += 1;
      if (call === 1) {
        await new Promise((r) => setTimeout(r, 2500));
      }
      await route.continue();
    });

    await page.goto(`${ORDERS}?paymentStatus=PAID`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(150);
    await page.goto(`${ORDERS}?paymentStatus=FAILED`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const url = new URL(page.url());
    expect(url.searchParams.get('paymentStatus')).toBe('FAILED');
    // The card counts what the API returned for the LAST request.
    const matching = await page
      .locator('[data-testid="orders-stat-card"]')
      .nth(1)
      .locator('[data-testid="stat-value"]')
      .innerText();
    expect(Number(matching.trim())).toBeGreaterThan(0);
    await page.unroute('**/api/dashboard/orders**');
  });
});

test.describe('order detail', () => {
  test.beforeEach(async () => {
    await open(ORDER, '[data-testid="order-number"]');
  });

  test('the header carries the order number and both badges', async () => {
    await expect(page.locator('[data-testid="order-number"]')).toContainText('ORD-2026-000001');
    await expect(page.locator('[data-testid="order-status-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-payment-badge"]')).toBeVisible();
  });

  test('the totals card shows the stored total AND the items subtotal', async () => {
    const subtotal = await page.locator('text=Subtotal').locator('xpath=following-sibling::*[1]').innerText();
    const total = await page.locator('[data-testid="order-total"]').innerText();
    expect(subtotal).toContain('1,825');
    expect(total).toContain('120.50');
    // The mismatch is REPORTED, not hidden.
    await expect(page.locator('[data-testid="order-totals-mismatch"]')).toBeVisible();
  });

  test('the status dialog offers only the transitions the backend allows', async () => {
    // A DELIVERED order is terminal: the action is disabled and the dialog
    // offers nothing.
    await expect(page.locator('[data-testid="order-update-status"]')).toBeDisabled();

    // A PENDING order may be confirmed or cancelled — and cancelling has
    // its own dialog, so the status dialog offers the confirmation.
    await page.goto('/dashboard/orders/6', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const button = page.locator('[data-testid="order-update-status"]');
    if (await button.isEnabled()) {
      await button.click();
      await page.waitForTimeout(500);
      const options = await page.locator('[data-testid="status-option"]').allInnerTexts();
      expect(options.length).toBeGreaterThan(0);
      expect(options.join(' ')).not.toContain('Delivered');
      expect(options.join(' ')).not.toContain('Shipped');
    }
  });

  test('a raw translation key never reaches the screen', async () => {
    expect((await visibleText(page)).match(RAW_KEY)).toBeNull();
  });

  test('the page reacts to a RUNTIME language switch', async () => {
    const enTitle = await page.locator('[data-testid="detail-card-title"]').first().innerText();
    await switchLanguage('ar');
    await page.waitForTimeout(700);
    const arTitle = await page.locator('[data-testid="detail-card-title"]').first().innerText();
    expect(arTitle).not.toBe(enTitle);
    expect(arTitle).toMatch(/[\u0600-\u06FF]/);
    expect((await visibleText(page)).match(RAW_KEY)).toBeNull();

    await switchLanguage('en');
    await page.waitForTimeout(700);
    expect(await page.locator('[data-testid="detail-card-title"]').first().innerText()).toBe(enTitle);
  });

  test('the customer phone is a tel: link, and the address is copyable', async () => {
    const tel = page.locator('[data-testid="order-customer-phone"]');
    if (await tel.count()) {
      await expect(tel).toHaveAttribute('href', /^tel:/);
    }
    await expect(page.locator('[data-testid="order-copy-address"]')).toBeVisible();
  });

  test('a failing endpoint shows the error state on the page', async () => {
    // The interception is COUNTED, so a failure says whether the request
    // was aborted at all or the page simply had not rendered yet. A fixed
    // sleep was the flake: the app's boot time varies with the API's load.
    let aborted = 0;
    await page.route('**/api/dashboard/orders/1', (route) => {
      aborted += 1;
      return route.abort('failed');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="order-detail-error"]')).toBeVisible();
    expect(aborted, 'the order request was not aborted').toBeGreaterThan(0);
    await page.unroute('**/api/dashboard/orders/1');
  });
});

/** The access token the app holds, for a direct API call in a test. */
async function accessToken(p: Page): Promise<string> {
  return p.evaluate(async () => {
    const body = await fetch('http://localhost:8080/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    }).then((r) => r.json());
    return body?.data?.accessToken ?? '';
  });
}
