import { test, expect, type BrowserContext, type JSHandle, type Page } from '@playwright/test';
import { creds } from './helpers/auth';

/**
 * FE-27 — a console page may never render a BLANK body.
 *
 * The failure this catches is the one no unit test can see: a request fails (or
 * a permission/route mistake renders nothing) and the page ends up as a title,
 * a toolbar and empty cream space — no skeleton, no empty state, no error and
 * no retry. It was a real defect on `/dashboard`, where a failed overview
 * skipped the entire body behind `@if (!overviewError())` with no `@else`.
 *
 * The check is deliberately NOT "the body is short". A designed state is
 * legitimately short in text (an empty state is a title, a hint and a button),
 * so the rule is:
 *
 *   a page is FINE when the routed component region holds
 *     - meaningful content (enough text, or real controls), OR
 *     - a designed state: a skeleton, an empty state, or an error with a retry.
 *
 *   a page is BLANK when it has none of those.
 *
 * `assessBody` is self-contained so Playwright can inject it into the page. The
 * last three tests run it against synthetic DOMs — a bare body, a designed
 * empty state and an error with no retry — so this spec cannot pass by being
 * vacuous.
 */

interface Verdict {
  ok: boolean;
  reason: string;
  text: number;
  controls: number;
  skeleton: boolean;
  empty: boolean;
  errorRetry: boolean;
}

/** Injected into the page: never references anything outside itself. */
function assessBody(root: Element | null): Verdict {
  const MIN_TEXT = 80;
  const MIN_CONTROLS = 2;

  if (!root) {
    return {
      ok: false,
      reason: 'the routed component rendered nothing at all',
      text: 0,
      controls: 0,
      skeleton: false,
      empty: false,
      errorRetry: false,
    };
  }

  const element = root as HTMLElement;
  const visible = element.getClientRects().length > 0;
  const text = (element.innerText ?? element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const controls = element.querySelectorAll(
    'a[href], button, input, select, textarea, [role="button"], [tabindex="0"]',
  ).length;

  // A skeleton: the shared pulse/spin classes, an aria-busy table, or a
  // first-load placeholder that names itself.
  const skeleton = !!element.querySelector(
    '[class*="animate-pulse"], [class*="skeleton"], [class*="animate-spin"], [aria-busy="true"], [data-testid$="-skeleton"]',
  );

  // A designed empty state: the shared component, the table's empty row, or a
  // page-specific empty block.
  const empty = !!element.querySelector(
    'app-empty-state, [data-testid="table-empty"], [data-testid$="-empty"], [data-testid$="-empty-state"]',
  );

  // An error WITH a retry — the part that makes a failure survivable.
  const alerts = [...element.querySelectorAll('[role="alert"]')];
  const errorRetry = alerts.some((alert) =>
    [...alert.querySelectorAll('button, a[href]')].some((control) =>
      /retry|try again|إعادة|حاول/i.test(control.textContent ?? ''),
    ),
  );

  const hasContent = text.length >= MIN_TEXT || controls >= MIN_CONTROLS;
  const ok = visible && (hasContent || skeleton || empty || errorRetry);

  const reason = ok
    ? 'ok'
    : `blank body: ${text.length} chars of text, ${controls} controls, ` +
      `skeleton=${skeleton}, empty=${empty}, error+retry=${errorRetry}`;

  return { ok, reason, text: text.length, controls, skeleton, empty, errorRetry };
}

/**
 * Every console page reachable without an id in the URL. Detail pages are
 * covered by their own suites; this one is about the LIST/CONSOLE surfaces,
 * which is where a failed fetch used to leave nothing behind.
 */
const PAGES = [
  '/dashboard',
  '/dashboard/orders',
  '/dashboard/carts',
  '/dashboard/reviews',
  '/dashboard/contact-messages',
  '/dashboard/users',
  '/dashboard/users/roles',
  '/dashboard/journal',
  '/dashboard/journal/categories',
  '/dashboard/broadcasts',
  '/dashboard/newsletter',
  '/dashboard/notifications',
  '/dashboard/products',
  '/dashboard/product-tags',
  '/dashboard/product-options',
  '/dashboard/categories',
  '/dashboard/origins',
  '/dashboard/farms',
  '/dashboard/roast-levels',
  '/dashboard/processing-methods',
  '/dashboard/coffee-varieties',
  '/dashboard/tasting-notes',
  '/dashboard/shipping-zones',
  '/dashboard/promo-codes',
  '/dashboard/brewing-methods',
  '/dashboard/pairings',
  '/dashboard/store-settings',
  '/dashboard/profile',
];

let context: BrowserContext;
let page: Page;

/** The routed component's root: Angular renders it right after the outlet. */
async function routedRoot(): Promise<JSHandle> {
  return page.evaluateHandle(() => {
    const outlet = document.querySelector('main router-outlet');
    return outlet?.nextElementSibling ?? null;
  });
}

async function verdictFor(root: JSHandle): Promise<Verdict> {
  return page.evaluate(assessBody, root);
}

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // The login endpoint is rate limited (5/min per IP and per identifier), so a
  // 429 is server behaviour, not a defect: back off and retry.
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

test.describe('no blank bodies', () => {
  for (const path of PAGES) {
    test(`${path} renders content or a designed state`, async () => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Poll instead of sleeping: a slow endpoint settles at its own pace, and
      // the verdict only has to be reached once.
      await expect
        .poll(
          async () => {
            const verdict = await verdictFor(await routedRoot());
            return verdict.ok ? 'ok' : verdict.reason;
          },
          {
            timeout: 25_000,
            message: `${path} never left the blank state`,
            intervals: [250, 500, 1000, 2000],
          },
        )
        .toBe('ok');
    });
  }
});

test.describe('the detector itself', () => {
  /** Build a detached probe and return its handle. */
  async function probe(html: string, tag = 'section'): Promise<JSHandle> {
    return page.evaluateHandle(
      ({ markup, element }) => {
        const root = document.createElement(element);
        root.innerHTML = markup;
        document.body.appendChild(root);
        return root;
      },
      { markup: html, element: tag },
    );
  }

  test.beforeEach(async () => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  });

  test('a blank body FAILS the check (the spec is not vacuous)', async () => {
    // A title and a count are not a page: no skeleton, no empty state, no error.
    const verdict = await verdictFor(
      await probe('<h1>Categories</h1><p>0 total</p>'),
    );

    expect(verdict.ok, verdict.reason).toBe(false);
    expect(verdict.reason).toContain('blank body');
  });

  test('a designed empty state PASSES the check', async () => {
    // The probe root must be a CONTAINER: the detector looks for the empty-state
    // component among its descendants, so the component cannot also be the root.
    const verdict = await verdictFor(
      await probe(
        '<app-empty-state>' +
          '<p>No categories yet</p><p>Add a category to organize your products.</p>' +
          '<button>Add category</button>' +
          '</app-empty-state>',
        'section',
      ),
    );

    expect(verdict.empty, verdict.reason).toBe(true);
    expect(verdict.ok, verdict.reason).toBe(true);
  });

  test('an error WITHOUT a retry FAILS the check', async () => {
    const verdict = await verdictFor(
      await probe('<div role="alert"><p>Something went wrong.</p></div>'),
    );

    // The message alone is a dead end: no retry, no way forward.
    expect(verdict.errorRetry, verdict.reason).toBe(false);
    expect(verdict.ok, verdict.reason).toBe(false);
  });

  test('an error WITH a retry PASSES the check', async () => {
    const verdict = await verdictFor(
      await probe('<div role="alert"><p>Could not load</p><button>Retry</button></div>'),
    );

    expect(verdict.errorRetry, verdict.reason).toBe(true);
    expect(verdict.ok, verdict.reason).toBe(true);
  });
});
