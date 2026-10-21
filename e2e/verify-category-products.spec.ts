import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * Category-detail PRODUCTS contract — table only.
 *
 * The products of a category used to render as a grid of cards behind a
 * grid/list toggle. The toggle is gone: the embedded products list IS the
 * shared DataTable the catalog lists use, with the same pagination footer —
 * the range line ("1 - 4 of 4") and the per-page select (10/20/50, default 20).
 *
 *   AC-P1 the products render as table rows; no grid card and no view toggle
 *   AC-P2 the pager shows the range line and the per-page select, default 20
 *   AC-P3 changing per-page returns to page 0 and refetches with the new `size`
 *   AC-P4 the featured star lives in the Featured column: featured rows only,
 *         with a tooltip and an aria-label
 *   AC-P5 a multi-page list pages through the shared pager (mocked 45 rows:
 *         strip + prev/next, range line follows the page, per-page resets to 1)
 *   AC-P6 the row's name link resolves to an EXISTING route (the product editor)
 *   AC-P7 a failed products fetch renders an error state + Retry, never the
 *         "no products yet" empty state
 *
 * Test data: /dashboard/categories/coffee holds 4 products, ALL featured;
 * /dashboard/categories/equipment holds products, none featured. Nothing here
 * invents data — the row/star counts are read live. AC-P5 and AC-P7 are the
 * only tests that mock: the seed is far too small to exercise a second page,
 * and no seeded category fails to load.
 */

const COFFEE = '/dashboard/categories/coffee';
const EQUIPMENT = '/dashboard/categories/equipment';
const DESKTOP = { width: 1440, height: 900 };
/** The embedded products endpoint of ANY category. */
const PRODUCTS_RE = /\/api\/categories\/[^/]+\/products(\?|$)/;

const rows = (page: Page) => page.locator('main tbody tr');
/** The pager's range line: "1 - 4 of 4" / "1 - 4 من 4". */
const rangeLine = (page: Page) => page.locator('app-pager span.tabular-nums').first();
/** The pager's rows-per-page select (shared HlmNativeSelect). */
const perPage = (page: Page) =>
  page.locator('app-pager select[data-slot="native-select"]');

/** A deterministic PageResponse for the embedded products endpoint. */
const productsPageResponse = (page: number, size: number, total: number) => {
  const count = Math.max(Math.min(size, total - page * size), 0);
  return {
    success: true,
    message: null,
    data: {
      content: Array.from({ length: count }, (_, i) => {
        const n = page * size + i + 1;
        return {
          id: String(n),
          slug: `mock-product-${n}`,
          name: `Mocked product ${n}`,
          categorySlug: 'coffee',
          productType: 'BEANS',
          shortDescription: '',
          featured: false,
          primaryImageUrl: null,
          maxPrice: '10.00',
          minPrice: '10.00',
          discountPercentage: '0',
          isActive: true,
        };
      }),
      page,
      size,
      totalElements: total,
      totalPages: Math.ceil(total / size),
      first: page === 0,
      last: page >= Math.ceil(total / size) - 1,
    },
    errors: null,
    timestamp: '2026-01-01T00:00:00Z',
  };
};

test.describe('Category detail products — table only', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: DESKTOP });
    page = await context.newPage();
    // One login per suite — login is rate limited to 5/min.
    for (let attempt = 1; attempt <= 3; attempt++) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      if (result.status === 429) {
        await page.waitForTimeout(20_000);
        continue;
      }
      if (result.status !== 200) throw new Error(`login failed with ${result.status}`);
      // The role in the body is not a durable assertion: the SPA navigates away
      // the moment the 200 lands and `submitLogin` may lose the buffer. The
      // URL is the durable proof — the app's admin gate keeps a non-admin on
      // /login, so reaching /dashboard means an ADMIN session.
      await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
      return;
    }
    throw new Error('login stayed rate-limited (429) after 3 attempts');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-P1: products render as a table; the grid and its toggle are gone', async () => {
    await page.goto(COFFEE);
    await expect(rows(page).first()).toBeVisible();
    expect(await rows(page).count(), 'coffee should list products').toBeGreaterThan(0);

    // The table's own identity: the shared DataTable's main cell (name link +
    // slug handle), which the grid never rendered.
    await expect(page.locator('main [data-testid="name-link"]').first()).toBeVisible();
    await expect(page.locator('main [data-testid="slug-text"]').first()).toBeVisible();

    // Grid artefacts must not exist anywhere on the page. The card grid's own
    // signature was its 4:3 image box (the image card uses aspect-video), so a
    // re-introduced grid is caught by either signature.
    await expect(
      page.locator('main .aspect-\\[4\\/3\\]'),
      'a grid card is still rendered',
    ).toHaveCount(0);
    const buttonLabels = await page
      .locator('button[aria-label]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
    expect(
      buttonLabels.filter((label) => /grid|شبك/i.test(label)),
      'a grid/list view toggle is back',
    ).toEqual([]);
  });

  test('AC-P2: range line + per-page select are the shared pager contract', async () => {
    await page.goto(COFFEE);
    await expect(rows(page).first()).toBeVisible();

    const total = await rows(page).count();
    await expect(rangeLine(page)).toHaveText(new RegExp(`^\\s*1\\s*-\\s*${total}\\s+(of|من)\\s+${total}\\s*$`));

    const select = perPage(page);
    await expect(select, 'the per-page select is missing').toBeVisible();
    await expect(select).toHaveValue('20');
    const options = await select.locator('option').evaluateAll((els) =>
      els.map((el) => (el as HTMLOptionElement).value),
    );
    expect(options, 'per-page choices must match the catalog lists').toEqual(['10', '20', '50']);
  });

  test('AC-P3: changing per-page returns to page 0 and refetches with the new size', async () => {
    await page.goto(COFFEE);
    await expect(rows(page).first()).toBeVisible();

    const refetch = page.waitForRequest(
      (r) => r.url().includes(`/api/categories/coffee/products`) && r.url().includes('size=10'),
    );
    await perPage(page).selectOption('10');
    await refetch;

    // The reload replaces the table with the skeleton and back — wait for rows.
    await expect(rows(page).first()).toBeVisible();
    const total = await rows(page).count();
    await expect(rangeLine(page)).toHaveText(new RegExp(`^\\s*1\\s*-\\s*${total}\\s+(of|من)\\s+${total}\\s*$`));
    await expect(perPage(page)).toHaveValue('10');
  });

  test('AC-P4: the featured star is in the Featured column, featured rows only', async () => {
    await page.goto(COFFEE);
    await expect(rows(page).first()).toBeVisible();

    // coffee seed: every product is featured → every row carries the star.
    const rowCount = await rows(page).count();
    const stars = page.locator('main tbody [role="img"][aria-label]');
    await expect(stars).toHaveCount(rowCount);
    for (let i = 0; i < rowCount; i += 1) {
      await expect(stars.nth(i)).toHaveAttribute('aria-label', /Featured|مميز/);
      await expect(stars.nth(i)).toHaveAttribute('title', /Featured|مميز/);
    }

    // equipment seed: no featured products → no star at all (the counter-check
    // that keeps the assertion above non-vacuous).
    await page.goto(EQUIPMENT);
    await expect(rows(page).first()).toBeVisible();
    await expect(
      page.locator('main tbody [role="img"][aria-label]'),
      'non-featured rows must not render a star',
    ).toHaveCount(0);
  });

  test('AC-P5: a multi-page list pages through the shared pager (mocked 45 rows)', async () => {
    await page.route(PRODUCTS_RE, (route) => {
      const url = new URL(route.request().url());
      const p = Number(url.searchParams.get('page') ?? '0');
      const size = Number(url.searchParams.get('size') ?? '20');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(productsPageResponse(p, size, 45)),
      });
    });

    await page.goto(COFFEE);
    await expect(rows(page).first()).toBeVisible();

    // Default size 20 → page 1 of 3, range 1 - 20.
    await expect(rangeLine(page)).toHaveText(/^\s*1\s*-\s*20\s+(of|من)\s+45\s*$/);
    await expect(rows(page)).toHaveCount(20);

    // Numbered strip: page 2 renders rows 21 - 40.
    const pageTwo = page.waitForRequest(
      (r) => PRODUCTS_RE.test(r.url()) && new URL(r.url()).searchParams.get('page') === '1',
    );
    await page.getByRole('button', { name: /^(Page|صفحة) 2$/ }).click();
    await pageTwo;
    await expect(rangeLine(page)).toHaveText(/^\s*21\s*-\s*40\s+(of|من)\s+45\s*$/);

    // Per-page change from a non-first page returns to page 0 with the new size.
    const resized = page.waitForRequest(
      (r) =>
        PRODUCTS_RE.test(r.url()) &&
        new URL(r.url()).searchParams.get('page') === '0' &&
        new URL(r.url()).searchParams.get('size') === '10',
    );
    await perPage(page).selectOption('10');
    await resized;
    await expect(rangeLine(page)).toHaveText(/^\s*1\s*-\s*10\s+(of|من)\s+45\s*$/);
    // …and page 1 is the active page again.
    await expect(page.getByRole('button', { name: /^(Page|صفحة) 2$/ })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('button', { name: /^(Page|صفحة) 1$/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('AC-P6: the row name link resolves to the product editor (no dead route)', async () => {
    await page.goto(COFFEE);
    const link = page.locator('main [data-testid="name-link"]').first();
    await expect(link).toBeVisible();

    // Products have no detail page in this app; the only product surface is the
    // wizard. Linking anywhere else (e.g. `/dashboard/products/{slug}`) matches
    // no route and the click silently does nothing.
    const href = await link.getAttribute('href');
    expect(href, 'the products table must link to an existing route').toMatch(
      /^\/dashboard\/products\/[^/]+\/edit$/,
    );

    await link.click();
    await expect(page).toHaveURL(/\/dashboard\/products\/[^/]+\/edit$/);
  });

  test('AC-P7: a failed products fetch shows an error state, not an empty category', async () => {
    let fail = true;
    await page.route(PRODUCTS_RE, (route) => {
      if (fail) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'boom',
            data: null,
            errors: null,
            timestamp: '2026-01-01T00:00:00Z',
          }),
        });
      }
      const url = new URL(route.request().url());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          productsPageResponse(
            Number(url.searchParams.get('page') ?? '0'),
            Number(url.searchParams.get('size') ?? '20'),
            3,
          ),
        ),
      });
    });

    await page.goto(COFFEE);

    // The failure must be stated, not disguised as an empty category.
    const errorCopy = page.locator('main').getByText(/Could not load products|تعذّر تحميل المنتجات/);
    await expect(errorCopy).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await expect(
      page.locator('main').getByText(/No products in this category yet|لا توجد منتجات في هذه الفئة/),
      'a failed fetch must not claim the category is empty',
    ).toHaveCount(0);

    // Retry succeeds against the recovered backend and the table returns.
    fail = false;
    await page.getByRole('button', { name: /Retry|إعادة المحاولة/ }).click();
    await expect(rows(page).first()).toBeVisible();
    await expect(rows(page)).toHaveCount(3);
  });
});
