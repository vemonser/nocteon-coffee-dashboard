import { expect, test, type Page, type Route } from '@playwright/test';
import { creds, fillLoginForm, gotoLogin, submitLogin } from './helpers/auth';

/**
 * Numbered pagination + per-page size selector (categories list).
 * The list GET is intercepted and FULFILLED with deterministic fake pages
 * (190 elements) so the multi-page UI is testable without touching backend
 * data. Asserts:
 *  - strip renders `1 2 3 … 10` at default size 20 (+ prev/next + active state)
 *  - clicking a numbered page requests page=N&size=M and updates the strip
 *  - per-page select change resets to page 0 and re-requests with new size
 *  - pager is completely hidden for 0 total rows
 */

const TOTAL = 190;
const LIST_RE = /\/api\/dashboard\/categories(\?|$)/;
const TRASH_RE = /\/api\/dashboard\/categories\/deleted(\?|$)/;

const catResponse = (page: number, size: number) => {
  const start = page * size;
  const count = Math.min(size, TOTAL - start);
  const content = Array.from({ length: Math.max(count, 0) }, (_, i) => ({
    id: start + i + 1,
    slug: `mock-cat-${start + i + 1}`,
    description: null,
    imageUrl: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    isActiveLabel: null,
    translations: [
      { language: 'en', name: `Mocked category ${start + i + 1}`, description: null },
      { language: 'ar', name: `فئة وهمية ${start + i + 1}`, description: null },
    ],
  }));
  return {
    success: true,
    message: null,
    data: {
      content,
      page,
      size,
      totalElements: TOTAL,
      totalPages: Math.ceil(TOTAL / size),
      first: page === 0,
      last: page >= Math.ceil(TOTAL / size) - 1,
    },
    errors: null,
    timestamp: '2026-01-01T00:00:00Z',
  };
};

let page: Page;

test.beforeEach(async ({ browser }) => {
  page = await browser.newPage();
  await gotoLogin(page);
  await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
  await submitLogin(page);

  const listRe = LIST_RE;
  await page.route(listRe, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();
    const url = new URL(req.url());
    const page_ = Number(url.searchParams.get('page') ?? '0');
    const size = Number(url.searchParams.get('size') ?? '20');
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(catResponse(page_, size)),
    });
  });
  // tab-count + trash fetch ride the same fulfill (they call loadPage)

  const seen: string[] = [];
  page.on('request', (r) => {
    if (listRe.test(r.url()) && r.method() === 'GET') {
      const u = new URL(r.url());
      seen.push(`page=${u.searchParams.get('page')},size=${u.searchParams.get('size')}`);
    }
  });
  (page as unknown as { seenGetParams: string[] }).seenGetParams = seen;

  await page.goto('/dashboard/categories');
  await expect(page.locator('table tbody tr').first()).toBeVisible();
  await expect(page.locator('app-pager')).toBeVisible();
});

test.afterEach(async () => {
  await page.close();
});

const seenGets = () =>
  (page as unknown as { seenGetParams: string[] }).seenGetParams;

test('strip shows 1 2 3 … 10 at default size 20; active page marked; prev/next work', async () => {
  const pager = page.locator('app-pager');

  const numbers = pager.locator('button.tabular-nums');
  await expect(numbers).toHaveCount(4); // 1 2 3 … 10 → strip = three + first + last
  await expect(numbers.first()).toHaveText('1');
  await expect(numbers.last()).toHaveText('10');
  await expect(pager.getByText('…')).toHaveCount(1);
  await expect(pager.locator('[aria-current="page"]')).toHaveText('1');

  // 1 - 20 of 190 range line
  await expect(pager.getByText(/1 - 20/)).toContainText('190');

  // next → page 2 strip window slides
  await pager.getByRole('button', { name: /Next page|الصفحة التالية/ }).click();
  await expect(pager.locator('[aria-current="page"]')).toHaveText('2');
  expect(seenGets().some((s) => s === 'page=1,size=20')).toBe(true);

  // jump to page 10 (ellipsis layout: prior window 8..10? cur=1. Actually last button is labeled Page 10)
  await pager.getByRole('button', { name: 'Page 10', exact: true }).click();
  await expect(pager.locator('[aria-current="page"]')).toHaveText('10');
  expect(seenGets().some((s) => s === 'page=9,size=20')).toBe(true);
  await expect(pager.getByRole('button', { name: /Next page|الصفحة التالية/ })).toBeDisabled();
  await expect(pager.getByRole('button', { name: /Previous page|الصفحة السابقة/ })).toBeEnabled();

  // range line follows
  await expect(pager.getByText(/181 - 190/)).toBeVisible();
});

test('per-page select: 10 rows resets to page 0 and re-requests size=10', async () => {
  const pager = page.locator('app-pager');
  await expect(pager.locator('select')).toBeVisible();

  await pager.locator('select').selectOption('10');
  await expect(pager.locator('[aria-current="page"]')).toHaveText('1');
  expect(seenGets().some((s) => s === 'page=0,size=10')).toBe(true);

  // 190 rows at size 10 → 19 pages; strip is 1 2 3 … 19
  const numbers = pager.locator('button.tabular-nums');
  await expect(numbers.last()).toHaveText('19');
  await expect(pager.getByText(/1 - 10/)).toContainText('190');
});

test('clicking a middle numbered page requests the right page', async () => {
  const pager = page.locator('app-pager');
  await pager.getByRole('button', { name: 'Page 3', exact: true }).click();
  await expect(pager.locator('[aria-current="page"]')).toHaveText('3');
  expect(seenGets().some((s) => s === 'page=2,size=20')).toBe(true);
  await expect(pager.getByText(/41 - 60/)).toBeVisible();
});

test('pager hidden entirely when the list is empty', async () => {
  // Re-route to an empty page for this test only.
  await page.unroute(LIST_RE);
  await page.route(/\/api\/dashboard\/categories(\?|$)/, async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const response = catResponse(Number(url.searchParams.get('page') ?? '0'), Number(url.searchParams.get('size') ?? '20'));
    response.data.content = [];
    response.data.totalElements = 0;
    response.data.totalPages = 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });
  await page.reload();
  await expect(page.locator('app-pager')).toHaveCount(0);
});
const TRASH_TOTAL = 47;

const trashResponse = (page: number, size: number) => {
  const res = catResponse(page, size);
  res.data.totalElements = TRASH_TOTAL;
  res.data.totalPages = Math.ceil(TRASH_TOTAL / size);
  res.data.content = res.data.content.map((row: { id: number; slug: string }) => {
    row.id += 20_000;
    row.slug = `mock-del-${row.id}`;
    return row;
  });
  return res;
};

test('trash tab: pager works and the per-page select sends size to /deleted', async () => {
  const seenTrash: string[] = [];
  await page.route(TRASH_RE, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = new URL(route.request().url());
    const p = Number(url.searchParams.get('page') ?? '0');
    const s = Number(url.searchParams.get('size') ?? '20');
    seenTrash.push(`page=${p},size=${s}`);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(trashResponse(p, s)),
    });
  });

  const pager = page.locator('app-pager');

  // switch to the trash tab (lifecycle-tabs)
  await page.getByRole('tab', { name: /Trash|المهملات/ }).click();
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 8000 });

  // 47 rows @ 20 → 3 pages: 1 2 3 (no ellipsis)
  const numbers = pager.locator('button.tabular-nums');
  await expect(numbers).toHaveCount(3);
  await expect(pager.getByText(/1 - 20/)).toContainText('47');

  // THE FIX under test: size select in trash must actually send size to /deleted
  await pager.locator('select').selectOption('10');
  await expect(numbers).toHaveCount(5); // 47 @ 10 → 5 pages? 1,2,3,4,5
  expect(seenTrash.some((s) => s === 'page=0,size=10')).toBe(true);

  await pager.getByRole('button', { name: 'Page 3', exact: true }).click();
  await expect(pager.locator('[aria-current="page"]')).toHaveText('3');
  expect(seenTrash.some((s) => s === 'page=2,size=10')).toBe(true);
  await expect(pager.getByText(/21 - 30/)).toContainText('47');
});

test('size choice persists across reload via the ?size= URL param', async () => {
  const pager = page.locator('app-pager');

  await pager.locator('select').selectOption('10');
  await expect(pager.locator('button.tabular-nums').last()).toHaveText('19');

  // URL carries size; reload restores it (both the select and the requests)
  await expect(page).toHaveURL(/size=10/);
  await page.reload();
  await expect(page.locator('table tbody tr').first()).toBeVisible();
  const url = new URL(page.url());
  expect(url.searchParams.get('size')).toBe('10');
  const fresh = page.locator('app-pager');
  await expect(fresh.locator('[aria-current="page"]')).toHaveText('1');
  await expect(fresh.locator('button.tabular-nums').last()).toHaveText('19');
});
