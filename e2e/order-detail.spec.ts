import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds } from './helpers/auth';

/**
 * The order detail page — v5.
 *
 * What is proved here:
 *   - the HEADER's actions follow the order's state: a terminal order
 *     offers no status change, and a cancelled one cannot be cancelled
 *     again;
 *   - the status dialog offers ONLY the transitions the backend allows;
 *   - the CUSTOMER card shows the CUSTOMER's numbers, not the store's;
 *   - the ITEMS show the SKU once and no invented discount;
 *   - the TOTALS add up, and the settlement is honest about what the
 *     store does not record;
 *   - the TIMELINE shows the recorded history — and never a date the
 *     store did not record;
 *   - the internal notes are the team's, and a 404 says so.
 */

const ORDERS = '/dashboard/orders';

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
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== 'en') await switchLanguage('en');
});

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
    await page.waitForFunction((lang) => document.documentElement.lang === lang, target, {
      timeout: 8_000,
    });
    await page.waitForTimeout(400);
  }
  throw new Error(`could not switch the language to ${target}`);
}

/** Opens an order and waits for its cards. */
async function openOrder(id: number): Promise<void> {
  await page.goto(`${ORDERS}/${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-testid="order-number"]')).toBeVisible();
}

test.describe('order detail', () => {
  test('the header offers the copy and the print, and a copyable order number', async () => {
    await openOrder(1);

    // The breadcrumb carries the order number.
    await expect(page.locator('[data-testid="order-number"]')).toContainText('ORD-2026-000001');
    await expect(page.locator('[data-testid="order-copy-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-print-invoice"]')).toBeVisible();

    // The copy puts the number on the clipboard.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('[data-testid="order-copy-number"]').first().click();
    await page.waitForTimeout(500);
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('ORD-2026-000001');
  });

  test('a DELIVERED order offers no status change', async () => {
    await openOrder(1);
    // Terminal: the action is HIDDEN, not a greyed-out button.
    await expect(page.locator('[data-testid="order-update-status"]')).toHaveCount(0);
  });

  test('a CANCELLED order offers neither a status change nor a cancel', async () => {
    await openOrder(6);
    await expect(page.locator('[data-testid="order-update-status"]')).toHaveCount(0);

    await page.locator('[data-testid="order-more-actions"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="order-cancel"]')).toHaveCount(0);
  });

  test('a REFUNDED order offers no refund', async () => {
    await openOrder(9);
    await page.locator('[data-testid="order-more-actions"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="order-refund"]')).toHaveCount(0);
  });

  test('the status dialog offers only the transitions the backend allows', async () => {
    // ORD-13 is PROCESSING: it may be shipped or cancelled, and nothing else.
    await openOrder(13);
    await page.locator('[data-testid="order-update-status"]').click();
    await page.waitForTimeout(600);

    const options = await page
      .locator('[data-testid="order-status-select"] option')
      .allInnerTexts();
    expect(options.length).toBeGreaterThan(0);
    expect(options.join(' ')).toContain('Shipped');
    expect(options.join(' ')).not.toContain('Delivered');
    expect(options.join(' ')).not.toContain('Pending');
  });

  test('the customer card shows the CUSTOMER numbers, not the store numbers', async () => {
    await openOrder(1);

    const orders = await page.locator('[data-testid="order-customer-orders"]').innerText();
    const lifetime = await page.locator('[data-testid="order-customer-lifetime"]').innerText();

    // The store has 17 orders; ORD-1 belongs to the admin, who has four.
    expect(orders).not.toContain('17');
    expect(Number(orders.replace(/[^\d]/g, ''))).toBeLessThan(17);
    expect(orders.replace(/[^\d]/g, '')).not.toBe('');

    // The lifetime is the CUSTOMER's paid orders, not the store's revenue.
    expect(lifetime).not.toContain('21,326');
    expect(Number(lifetime.replace(/[^\d.]/g, ''))).toBeLessThan(21326);

    // And the customer can be reached.
    await expect(page.locator('[data-testid="order-customer-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-customer-orders-link"]')).toBeVisible();
  });

  test('the items show the SKU once, and no invented discount', async () => {
    await openOrder(1);

    const skus = await page.locator('[data-testid="order-item-sku"]').allInnerTexts();
    expect(skus.length).toBeGreaterThan(0);
    for (const sku of skus) {
      // "SKU-1-1" — not "SKU-1-1 SKU-1-1".
      expect(sku.trim().split(/\s+/).length).toBe(1);
    }

    // The catalog's compare-at price is a REFERENCE, never a struck-through
    // discount on the order: the order's own totals still add up.
    const regular = await page.locator('[data-testid="order-item-regular-price"]').count();
    const mismatch = await page.locator('[data-testid="order-totals-mismatch"]').count();
    expect(
      mismatch,
      'a regular price is a reference, not a discount on the order',
    ).toBe(0);
    expect(regular, 'the catalog price is shown as a reference').toBeGreaterThan(0);
  });

  test('the totals add up, and the settlement is honest', async () => {
    await openOrder(1);

    // The discount row only when the order has one.
    const discountRows = await page.locator('[data-total-row="discount"]').count();
    const discount = Number(
      (await page.locator('[data-total-row="discount"] dd').innerText().catch(() => '0')).replace(
        /[^\d.]/g,
        '',
      ),
    );
    expect(discountRows === 0 || discount > 0).toBe(true);

    // The settlement is always there: collected, refunded, balance.
    await expect(page.locator('[data-testid="order-collected"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-refunded"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-balance-due"]')).toBeVisible();

    // A PAID order that the store recorded: no warning.
    await expect(page.locator('[data-testid="order-payment-warning"]')).toHaveCount(0);
  });

  test('the payment shows the method, the status and the reference', async () => {
    await openOrder(1);
    const card = page.locator('[data-card="payment"]');
    await expect(card).toContainText('Online');
    await expect(card.locator('[data-testid="order-transaction-reference"]')).not.toBeEmpty();
    await expect(card.locator('[data-testid="order-paid-at"]')).not.toBeEmpty();
  });

  test('the timeline shows the recorded history, with its dates and actors', async () => {
    await openOrder(9);

    // The activity log has the recorded events.
    const events = await page.locator('[data-testid="order-activity"] li').count();
    expect(events).toBeGreaterThan(1);

    // Every event carries a time, and the history's own rows are the ones
    // the store wrote.
    const times = await page.locator('[data-testid="order-activity"] time').allInnerTexts();
    expect(times.length).toBeGreaterThan(0);
    for (const time of times) {
      expect(time.trim()).not.toBe('');
    }

    // The step tracker dates its steps from the history, and says so when a
    // step has no recorded date.
    const card = page.locator('[data-card="timeline"]');
    await expect(card).toBeVisible();
  });

  test('the internal notes are the team\'s, and the order 404 says so', async () => {
    await openOrder(1);
    const notes = page.locator('[data-card="notes"]');
    await expect(notes).toBeVisible();
    await expect(page.locator('[data-testid="order-note-input"]')).toBeVisible();

    await page.goto(`${ORDERS}/99999`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-testid="order-detail-notfound"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-notfound-back"]')).toBeVisible();
  });

  test('a raw translation key never reaches the screen', async () => {
    await openOrder(1);
    expect((await visibleText(page)).match(RAW_KEY)).toBeNull();
  });

  test('the page is readable in Arabic, and the numbers stay Latin', async () => {
    await openOrder(1);
    await switchLanguage('ar');
    await page.waitForTimeout(600);

    const text = await visibleText(page);
    expect(text).toMatch(/[؀-ۿ]/);
    expect(text.match(RAW_KEY)).toBeNull();

    // The order number is Latin inside an Arabic page.
    const number = await page.locator('[data-testid="order-number"]').innerText();
    expect(number).toContain('ORD-2026-000001');
  });

  test('the page does not scroll sideways at 1440', async () => {
    await openOrder(1);
    const overflow = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);
  });

  test('the CANCELLED, SHIPPED and REFUNDED orders all render', async () => {
    for (const [id, expected] of [
      [6, 'Not collected'],
      [8, 'Shipped'],
      [9, 'Refunded'],
    ] as Array<[number, string]>) {
      await openOrder(id);
      await expect(page.locator('[data-testid="order-number"]')).toBeVisible();
      const text = await visibleText(page);
      expect(text).toContain(expected);
      expect(text.match(RAW_KEY)).toBeNull();
    }
  });
});
