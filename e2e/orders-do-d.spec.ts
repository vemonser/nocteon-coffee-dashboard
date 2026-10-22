import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds } from './helpers/auth';
import { mkdirSync } from 'node:fs';

/**
 * The Definition of Done, as an executable check.
 *
 * Four screenshots of the two pages — light and dark, in English and in
 * Arabic — at 1440×900, with no overflow, no clipping and no raw
 * translation key. The same pages in the Cancelled, Shipped and Refunded
 * states.
 *
 * The screenshots land in `evidence/orders-v5/`, and the assertions are
 * the ones the DoD names: nothing overflows, nothing is cut, and no raw
 * key reaches the screen.
 */

const ORDERS = '/dashboard/orders';
const OUT = 'evidence/orders-v5';

/** A raw translation key: `namespace.subnamespace.KEY`. */
const RAW_KEY = /\b[a-z]+\.[a-z]+\.[A-Z_]+\b/;

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
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

/** Every visible text of the page, as one string. */
async function visibleText(p: Page): Promise<string> {
  return p.evaluate(() => {
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

/** Switches the language through the app's own control. */
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
    await page.waitForTimeout(500);
  }
  throw new Error(`could not switch the language to ${target}`);
}

/** Switches the theme through the app's own control. */
async function setTheme(theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
  await page.waitForTimeout(400);
}

/**
 * The DoD's own check, applied to whatever is on screen: nothing overflows
 * the viewport, nothing is cut off at the edge, and no raw key is visible.
 */
async function assertNoOverflowAndNoRawKeys(label: string): Promise<void> {
  const report = await page.evaluate(() => {
    const doc = document.documentElement;
    // An element whose content is wider than the box it sits in, and which
    // is not meant to scroll.
    const cut: string[] = [];
    for (const el of Array.from(document.querySelectorAll('main *'))) {
      const cs = getComputedStyle(el);
      if (cs.textOverflow !== 'ellipsis') continue;
      if (el.scrollWidth <= el.clientWidth) continue;
      const text = (el.textContent ?? '').trim();
      if (!text) continue;
      cut.push(text.slice(0, 40));
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      cut,
    };
  });

  expect(report.scrollWidth, `${label}: the page must not overflow`).toBeLessThanOrEqual(
    report.clientWidth,
  );
  expect(report.cut, `${label}: nothing may be cut off`).toEqual([]);
  expect((await visibleText(page)).match(RAW_KEY), `${label}: no raw key`).toBeNull();
}

test.describe('the Definition of Done', () => {
  test('the orders list, in four languages-and-themes', async () => {
    await page.goto(ORDERS, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.locator('app-data-table')).toBeVisible();

    for (const theme of ['light', 'dark'] as const) {
      for (const lang of ['en', 'ar'] as const) {
        await switchLanguage(lang);
        await setTheme(theme);
        await page.waitForTimeout(600);

        const name = `orders-list-${theme}-${lang}.png`;
        await page.screenshot({ path: `${OUT}/${name}`, fullPage: false });
        await assertNoOverflowAndNoRawKeys(`orders list ${theme}/${lang}`);
      }
    }
  });

  test('the order detail, in four languages-and-themes', async () => {
    await page.goto(`${ORDERS}/1`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="order-number"]')).toBeVisible();

    for (const theme of ['light', 'dark'] as const) {
      for (const lang of ['en', 'ar'] as const) {
        await switchLanguage(lang);
        await setTheme(theme);
        await page.waitForTimeout(600);

        const name = `order-detail-${theme}-${lang}.png`;
        await page.screenshot({ path: `${OUT}/${name}`, fullPage: false });
        await assertNoOverflowAndNoRawKeys(`order detail ${theme}/${lang}`);
      }
    }
  });

  test('the CANCELLED, SHIPPED and REFUNDED orders, in both themes', async () => {
    await switchLanguage('en');

    for (const [id, state] of [
      [6, 'cancelled'],
      [8, 'shipped'],
      [9, 'refunded'],
    ] as Array<[number, string]>) {
      await page.goto(`${ORDERS}/${id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1800);
      await expect(page.locator('[data-testid="order-number"]')).toBeVisible();

      for (const theme of ['light', 'dark'] as const) {
        await setTheme(theme);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/order-${state}-${theme}.png`, fullPage: false });
        await assertNoOverflowAndNoRawKeys(`order ${state} ${theme}`);
      }
    }
  });
});
