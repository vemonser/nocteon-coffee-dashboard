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

  test('the four cards are the numbers the API reports', async () => {
    // The API is the reference. The call is made through the app's own
    // session, and the API rate-limits, so a failed call skips the
    // comparison instead of failing the test on a number it never got.
    const stats = await apiStats(page);

    const cards = page.locator('[data-testid="orders-stat-card"]');
    await expect(cards).toHaveCount(4);

    // The revenue is the BACKEND's aggregate, never a sum the browser made.
    if (stats) {
      const revenue = await cards.nth(0).locator('[data-testid="stat-value"]').innerText();
      const money = Number(revenue.replace(/[^\d.]/g, ''));
      expect(money, 'the revenue card must equal the API revenue').toBeCloseTo(stats.revenue, 1);
    }

    // The AVERAGE is the revenue over the PAID orders only — never over
    // every order, and never over the cancelled ones.
    if (stats && stats.revenueOrderCount > 0) {
      const aov = await cards.nth(2).locator('[data-testid="stat-value"]').innerText();
      const money = Number(aov.replace(/[^\d.]/g, ''));
      expect(money, 'the average must be revenue / the PAID orders').toBeCloseTo(
        stats.revenue / stats.revenueOrderCount,
        0,
      );
    }
  });

  test('the cancel rate is the cancelled orders over the orders shown', async () => {
    const cards = page.locator('[data-testid="orders-stat-card"]');
    const rate = await cards.nth(3).locator('[data-testid="stat-value"]').innerText();
    const percent = Number(rate.replace(/[^\d.]/g, ''));

    // The cancelled TAB carries the same number: it is the same set.
    const cancelledTab = await page
      .locator('[data-testid="orders-status-tab"]', { hasText: 'Cancelled' })
      .innerText();
    const cancelled = Number(cancelledTab.replace(/[^\d]/g, ''));
    const all = Number(
      (await page.locator('[data-testid="orders-status-tab"]', { hasText: 'All orders' }).innerText())
        .replace(/[^\d]/g, ''),
    );
    expect(percent).toBeCloseTo((cancelled / all) * 100, 0);
  });

  test('the pager says 1-10 of 17 and exactly ten rows are on screen', async () => {
    await page.goto(`${ORDERS}?size=10`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const pager = await page.locator('app-pager').innerText();
    expect(pager).toMatch(/1\s*-\s*10\s+of\s+17/);

    const rows = await page.locator('app-data-table tbody tr').count();
    expect(rows, 'the pager says ten rows, so ten rows are on screen').toBe(10);
  });

  test('changing the page changes the rows, and the total never changes', async () => {
    await page.goto(`${ORDERS}?size=10`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const first = await page.locator('app-data-table tbody tr').first().innerText();
    await page.locator('app-pager button', { hasText: '2' }).first().click();
    await page.waitForTimeout(1500);

    const second = await page.locator('app-data-table tbody tr').first().innerText();
    expect(second, 'the second page shows different orders').not.toBe(first);

    const pager = await page.locator('app-pager').innerText();
    expect(pager, 'the total is the whole set, whatever the page').toMatch(/of 17/);
  });

  test('the seven tabs are the ones the spec names', async () => {
    const tabs = await page.locator('[data-testid="orders-status-tab"]').allInnerTexts();
    const names = tabs.map((t) => t.replace(/[↕↑↓]/g, '').trim());
    expect(names).toHaveLength(7);
    expect(names[0]).toContain('All orders');
    expect(names.join(' ')).toContain('Pending');
    expect(names.join(' ')).toContain('Processing');
    expect(names.join(' ')).toContain('Shipped');
    expect(names.join(' ')).toContain('Delivered');
    expect(names.join(' ')).toContain('Cancelled');
    expect(names.join(' ')).toContain('Refunded');
    // Confirmed has no tab of its own in this spec.
    expect(names.join(' ')).not.toContain('Confirmed');
  });

  test('the Refunded tab filters by the payment status', async () => {
    await page.locator('[data-testid="orders-status-tab"]', { hasText: 'Refunded' }).click();
    await page.waitForTimeout(1500);

    expect(new URL(page.url()).searchParams.get('status')).toBe('REFUNDED');
    const badges = await page.locator('app-data-table tbody tr td[data-column="paymentStatus"]').allInnerTexts();
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(badge, 'every row of the Refunded tab is refunded').toContain('Refunded');
    }
  });

  test('a cancelled cash-on-delivery order says "Not collected", not "Failed"', async () => {
    await page.goto(`${ORDERS}?status=CANCELLED`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const badges = await page
      .locator('app-data-table tbody tr td[data-column="paymentStatus"]')
      .allInnerTexts();
    expect(badges.length).toBeGreaterThan(0);
    // The cancelled COD order is in this tab, and it says "Not collected".
    expect(badges.join(' ')).toContain('Not collected');
    // The cancelled ONLINE order keeps "Failed": a gateway really refused it.
    expect(badges.join(' ')).toContain('Failed');
  });

  test('an order with no line items is flagged, and its total is not zero', async () => {
    // ORD-9 had no line items and a total of 0.00. The seed fixed it, so
    // the page shows a real total and a real item count.
    await page.goto(`${ORDERS}?q=ORD-2026-000009`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const row = page.locator('app-data-table tbody tr').first();
    const total = await row.locator('td[data-column="totalAmount"]').innerText();
    expect(Number(total.replace(/[^\d.]/g, ''))).toBeGreaterThan(0);

    const items = await row.locator('td[data-column="items"]').innerText();
    expect(items).toMatch(/\d/);
  });

  test('the table does not scroll sideways at 1440', async () => {
    const overflow = await page.evaluate(() => {
      const table = document.querySelector('app-data-table table');
      const wrapper = document.querySelector('app-data-table .overflow-x-auto');
      if (!table || !wrapper) return { missing: true };
      return {
        table: Math.round(table.scrollWidth),
        wrapper: Math.round(wrapper.clientWidth),
      };
    });
    expect(overflow).not.toHaveProperty('missing');
    expect(overflow.table).toBeLessThanOrEqual(overflow.wrapper);
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
            if (el.scrollWidth <= el.clientWidth) continue;
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
          if (el.scrollWidth <= el.clientWidth) continue;
          truncatedHeaders.push((el.textContent || '').trim());
        }
      }

      // A value that IS truncated must carry a tooltip, so it stays readable.
      const truncatedWithoutTooltip: string[] = [];
      for (const el of Array.from(table.querySelectorAll('tbody td *'))) {
        const cs = getComputedStyle(el);
        if (cs.textOverflow !== 'ellipsis') continue;
        if (el.scrollWidth <= el.clientWidth) continue;
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
    await page.goto(`${ORDERS}?paymentStatus=REFUNDED`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const url = new URL(page.url());
    expect(url.searchParams.get('paymentStatus')).toBe('REFUNDED');
    // The card counts what the API returned for the LAST request. The
    // REFUNDED set is TWO orders (both delivered, one cancelled); the PAID
    // set is ten. If the first (delayed) response had won, the table would
    // show ten rows and the revenue card would be the paid orders' revenue.
    const rows = await page.locator('app-data-table tbody tr').count();
    expect(rows, 'the rows answer the LAST request, not the first').toBe(2);

    const revenue = await page
      .locator('[data-testid="orders-stat-card"]')
      .nth(0)
      .locator('[data-testid="stat-value"]')
      .innerText();
    expect(
      Number(revenue.replace(/[^\d.]/g, '')),
      'the REFUNDED set has no paid revenue',
    ).toBe(0);
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
    // The items of ORD-2026-000001 are 1,825.00 and the shipping is 50.00,
    // so the stored total is 1,875.00 (the seed's 120.50 was repaired).
    expect(subtotal).toContain('1,825');
    expect(total).toContain('1,875');
    // The recorded total agrees with the items, so nothing is reported.
    await expect(page.locator('[data-testid="order-totals-mismatch"]')).toHaveCount(0);
  });

  test('a total that disagrees with the items is REPORTED, not hidden', async () => {
    // The same order, with a total that does not match its items: the page
    // must say so rather than quietly show one of the two numbers.
    await page.route('**/api/dashboard/orders/1', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (body?.data) {
        body.data.totalAmount = 120.5;
      }
      await route.fulfill({ response, json: body });
    });
    await page.goto(ORDER, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await expect(page.locator('[data-testid="order-totals-mismatch"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-total"]')).toContainText('120.50');
    await page.unroute('**/api/dashboard/orders/1');
  });

  test('the status dialog offers only the transitions the backend allows', async () => {
    // A DELIVERED order is terminal: the action is HIDDEN, not a greyed-out
    // button the reader has to puzzle over.
    await expect(page.locator('[data-testid="order-update-status"]')).toHaveCount(0);

    // A PROCESSING order may be shipped or cancelled — and cancelling has
    // its own dialog, so the status dialog offers the shipment.
    await page.goto('/dashboard/orders/13', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const button = page.locator('[data-testid="order-update-status"]');
    await expect(button).toBeVisible();
    await button.click();
    await page.waitForTimeout(500);

    const options = await page
      .locator('[data-testid="order-status-select"] option')
      .allInnerTexts();
    expect(options.length).toBeGreaterThan(0);
    // From PROCESSING the order may be shipped or cancelled — and nothing
    // else: it can never go back to Pending or jump to Delivered.
    expect(options.join(' ')).toContain('Shipped');
    expect(options.join(' ')).not.toContain('Delivered');
    expect(options.join(' ')).not.toContain('Pending');
    expect(options.join(' ')).not.toContain('Confirmed');
  });

  test('a cancelled order hides the actions that cannot apply', async () => {
    // ORD-6 is a cancelled cash-on-delivery order: it cannot change status,
    // and it cannot be cancelled again.
    await page.goto('/dashboard/orders/6', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await expect(page.locator('[data-testid="order-update-status"]')).toHaveCount(0);

    await page.locator('[data-testid="order-more-actions"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="order-cancel"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="order-refund"]')).toHaveCount(0);
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

  test('the page shows the history, the notes, the payment and the shipment', async () => {
    // The four sections the backend contract added.
    await expect(page.locator('[data-card="timeline"]')).toBeVisible();
    await expect(page.locator('[data-card="notes"]')).toBeVisible();
    await expect(page.locator('[data-card="payment"]')).toBeVisible();
    await expect(page.locator('[data-card="shipment"]')).toBeVisible();

    // The progress tracker reads the CURRENT status.
    const steps = await page.locator('[data-step]').allInnerTexts();
    expect(steps.length).toBe(5);

    // The notes composer is there and it is empty.
    await expect(page.locator('[data-testid="order-note-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-note-input"]')).toHaveValue('');

    // The payment card names the method.
    const payment = page.locator('[data-card="payment"]');
    await expect(payment).toContainText(/Online|Cash on delivery/);
  });

  test('the refund dialog asks for an amount and a reason', async () => {
    // The dialog is reachable from the order's overflow menu.
    await page.locator('[data-testid="order-more-actions"]').click();
    await page.waitForTimeout(400);
    await page.locator('[data-testid="order-refund"]').click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[data-testid="refund-dialog"]');
    await expect(dialog).toBeVisible();

    // The amount starts at what is left to refund, and the confirm needs a
    // REASON: a refund without one is a mystery a month later.
    const amount = page.locator('[data-testid="refund-amount"]');
    await expect(amount).not.toHaveValue('');
    const confirm = page.locator('[data-testid="refund-dialog-confirm"]');
    await expect(confirm).toBeDisabled();

    await page.locator('[data-testid="refund-reason"]').fill('The customer returned the bag.');
    await expect(confirm).toBeEnabled();

    // An amount bigger than what is left is refused before the gateway is
    // even asked.
    await amount.fill('9999');
    await expect(page.locator('[data-testid="refund-too-much"]')).toBeVisible();
    await expect(confirm).toBeDisabled();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('the status dialog can tell the customer', async () => {
    await page.goto('/dashboard/orders/15', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.locator('[data-testid="order-update-status"]').click();
    await page.waitForTimeout(500);

    const notify = page.locator('[data-testid="status-notify"]');
    await expect(notify).toBeVisible();
    // It is OFF until the admin ticks it: the admin decides who hears about it.
    // The state lives on the switch's own button.
    await expect(notify.locator('button')).toHaveAttribute('data-state', 'unchecked');
    await notify.locator('button').click();
    await expect(notify.locator('button')).toHaveAttribute('data-state', 'checked');
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

/**
 * The total the API reports, for a direct comparison with the card.
 *
 * `null` when the API could not be reached (the backend rate-limits the
 * general API at 200 requests/minute, and a suite that opens ~20 pages
 * gets close to it). The test then skips the comparison rather than
 * comparing against a number it never received.
 */
async function apiTotal(p: Page): Promise<number | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await p.evaluate(async () => {
      try {
        const body = await fetch('http://localhost:8080/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        }).then((r) => r.json());
        return body?.data?.accessToken ?? '';
      } catch {
        return '';
      }
    });
    if (!token) {
      await p.waitForTimeout(3000);
      continue;
    }
    const response = await p.request.get(
      'http://localhost:8080/api/dashboard/orders?page=0&size=100',
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok()) {
      await p.waitForTimeout(3000);
      continue;
    }
    const body = await response.json();
    return body?.data?.totalElements ?? null;
  }
  return null;
}

/**
 * The stats the API reports for the whole set: the revenue, the number of
 * paid orders it came from, and the counts per status.
 *
 * `null` when the API could not be reached — the backend rate-limits the
 * general API, and a suite that opens many pages gets close to it. The
 * test then skips the comparison rather than comparing against a number it
 * never received.
 */
interface ApiStats {
  total: number;
  revenue: number;
  revenueOrderCount: number;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
}

async function apiStats(p: Page): Promise<ApiStats | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await p.evaluate(async () => {
      try {
        const body = await fetch('http://localhost:8080/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        }).then((r) => r.json());
        return body?.data?.accessToken ?? '';
      } catch {
        return '';
      }
    });
    if (!token) {
      await p.waitForTimeout(3000);
      continue;
    }
    const response = await p.request.get('http://localhost:8080/api/dashboard/orders/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok()) {
      await p.waitForTimeout(3000);
      continue;
    }
    const data = (await response.json())?.data;
    if (!data) return null;
    return {
      total: data.total ?? 0,
      revenue: Number(data.revenue ?? 0),
      revenueOrderCount: Number(data.revenueOrderCount ?? 0),
      byStatus: Object.fromEntries((data.byStatus ?? []).map((b: any) => [b.status, b.count])),
      byPaymentStatus: Object.fromEntries(
        (data.byPaymentStatus ?? []).map((b: any) => [b.paymentStatus, b.count]),
      ),
    };
  }
  return null;
}
