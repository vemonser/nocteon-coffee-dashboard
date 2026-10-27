import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';

/**
 * Catalogue smoke: every console page loads, asks the right endpoint, and the
 * backend answers 200 for an ADMIN.
 *
 * This is the front+back contract check the product asked for: a page can
 * render perfectly while its API is 500 (the dashboard did exactly that), so
 * each case watches the network response and fails on any 5xx during load.
 */

const CASES: Array<{ name: string; path: string; api: RegExp | null }> = [
  { name: 'users', path: '/dashboard/users', api: /\/api\/dashboard\/users\?/ },
  {
    name: 'roles',
    path: '/dashboard/users/roles',
    api: /\/api\/dashboard\/roles(\?|$)/,
  },
  { name: 'journal', path: '/dashboard/journal', api: /\/api\/dashboard\/journal\?/ },
  {
    name: 'store settings',
    path: '/dashboard/store-settings',
    api: /\/api\/settings(\?|$)/,
  },
  {
    name: 'newsletter',
    path: '/dashboard/newsletter',
    api: /\/api\/dashboard\/users\?/,
  },
  {
    name: 'broadcasts',
    path: '/dashboard/broadcasts',
    api: /\/api\/dashboard\/broadcasts\?/,
  },
  {
    name: 'promo codes',
    path: '/dashboard/promo-codes',
    api: /\/api\/dashboard\/promo-codes\?/,
  },
  { name: 'products', path: '/dashboard/products', api: /\/api\/dashboard\/products\?/ },
  { name: 'carts', path: '/dashboard/carts', api: /\/api\/dashboard\/carts\?/ },
  // The profile page reads the session, no list call: it only has to render.
  { name: 'profile', path: '/dashboard/profile', api: null },
  { name: 'orders', path: '/dashboard/orders', api: /\/api\/dashboard\/orders\?/ },
  { name: 'reviews', path: '/dashboard/reviews', api: /\/api\/dashboard\/reviews\?/ },
  {
    name: 'contact messages',
    path: '/dashboard/contact-messages',
    api: /\/api\/dashboard\/contact-messages\?/,
  },
  {
    name: 'notifications',
    path: '/dashboard/notifications',
    api: /\/api\/dashboard\/notifications\?/,
  },
  {
    name: 'product options',
    path: '/dashboard/product-options',
    api: /\/api\/dashboard\/product-options\?/,
  },
  {
    name: 'shipping zones',
    path: '/dashboard/shipping-zones',
    api: /\/api\/dashboard\/shipping-zones\?/,
  },
  { name: 'categories', path: '/dashboard/categories', api: /\/api\/dashboard\/categories\?/ },
  { name: 'origins', path: '/dashboard/origins', api: /\/api\/dashboard\/origins\?/ },
  { name: 'farms', path: '/dashboard/farms', api: /\/api\/dashboard\/farms\?/ },
  { name: 'pairings', path: '/dashboard/pairings', api: /\/api\/dashboard\/pairings\?/ },
  {
    name: 'coffee varieties',
    path: '/dashboard/coffee-varieties',
    api: /\/api\/dashboard\/coffee-varieties\?/,
  },
  {
    name: 'processing methods',
    path: '/dashboard/processing-methods',
    api: /\/api\/dashboard\/processing-methods\?/,
  },
  {
    name: 'roast levels',
    path: '/dashboard/roast-levels',
    api: /\/api\/dashboard\/roast-levels\?/,
  },
  {
    name: 'brewing methods',
    path: '/dashboard/brewing-methods',
    api: /\/api\/dashboard\/brewing-methods\?/,
  },
  {
    name: 'tasting notes',
    path: '/dashboard/tasting-notes',
    api: /\/api\/dashboard\/tasting-notes\?/,
  },
];

test.describe('catalogue consoles', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();

    // The login endpoint is rate limited (5/min); retry instead of failing the
    // whole suite when another run just logged in.
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      const landed = !page.url().includes('/login');
      if (result.status === 429 || !landed) {
        await page.waitForTimeout(20_000);
        continue;
      }
      // A null role is a timing artefact of reading the body after navigation;
      // the URL leaving /login is the proof the login landed.
      if (result.role && result.role !== 'ADMIN') {
        throw new Error(`this suite requires an ADMIN account (got ${result.role})`);
      }
      return;
    }
    throw new Error('login stayed rate-limited (429) after 4 attempts');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  for (const c of CASES) {
    test(`${c.name}: the page loads and its list API answers 200`, async () => {
      const serverErrors: string[] = [];
      const onResponse = (response: import('@playwright/test').Response) => {
        if (response.status() >= 500 && response.url().includes('/api/')) {
          serverErrors.push(`${response.status()} ${response.url()}`);
        }
      };
      page.on('response', onResponse);

      const listResponse = c.api
        ? page.waitForResponse((r) => c.api!.test(r.url()) && r.request().method() === 'GET', {
            timeout: 30_000,
          })
        : null;

      await page.goto(c.path, { waitUntil: 'domcontentloaded' });
      if (listResponse) {
        const response = await listResponse;
        expect(response.status(), `${c.name} list endpoint`).toBe(200);
      }

      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 });
      // A failed widget says so; a working page never shows the error copy.
      await expect(page.locator('body')).not.toContainText(/could not load|تعذّر التحميل/i);

      // Give the page a beat to finish its secondary calls, then check them.
      await page.waitForTimeout(800);
      page.off('response', onResponse);
      expect(serverErrors, `${c.name} must not produce 5xx responses`).toEqual([]);
    });
  }
});
