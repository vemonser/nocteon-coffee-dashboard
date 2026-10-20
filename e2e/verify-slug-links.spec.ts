import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * AC-SL1 — a list row's entity NAME is the control that opens that entity's
 * own page.
 *
 * The name is the single clickable control per row (real anchor when the host
 * supplies an href builder). Two render paths agree:
 *
 *  - 8 lists render `slug` as its own column — the slug stays a plain,
 *    unclickable handle there.
 *  - `categories` has no slug column: its slug lives inside the main cell
 *    (thumbnail + name + slug), as plain text under the name.
 *
 * The slug is read from the row it navigates from (`slug-text`), so a wrong-
 * entity navigation cannot pass.
 *
 * AC-SL2 — in the categories trash tab the row control stays absent. Trashed
 * rows are hidden from the backend detail queries and `goToDetail()` already
 * refuses to navigate, so a link that looks clickable but cannot go anywhere
 * would be a dead end (the same complaint this spec exists to prevent).
 *
 * ── WHY ONE SHARED SESSION (not per-test logins) ───────────────────────────
 * The same two real-stack constraints documented in verify-tables.spec.ts:
 *
 *  1. POST /api/auth/login is rate limited to 5/minute per IP *and* per
 *     identifier, so a login per test rate-limits the suite against itself.
 *  2. The refresh token rotates on every refresh AND reuse detection revokes
 *     the whole token family — a second context replayed from a saved
 *     storageState gets 401, and two overlapping page loads can log the
 *     session out.
 *
 * So: ONE context, ONE login, and strictly sequential page loads.
 */

interface ListCase {
  path: string;
  label: string;
}

const LISTS: ListCase[] = [
  { path: '/dashboard/categories', label: 'categories' },
  { path: '/dashboard/origins', label: 'origins' },
  { path: '/dashboard/farms', label: 'farms' },
  { path: '/dashboard/brewing-methods', label: 'brewing-methods' },
  { path: '/dashboard/pairings', label: 'pairings' },
];

/** Stable hooks on the row's name control and its slug handle. */
const NAME_LINK = 'name-link';
const SLUG_TEXT = 'slug-text';

const DESKTOP = { width: 1440, height: 900 };

async function openList(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(
    page.locator('table'),
    `no table rendered at ${path} (did the session survive?)`,
  ).toBeVisible();
}

/**
 * Logs in as the admin, tolerating the real login rate limit.
 *
 * POST /api/auth/login allows 5/minute per IP *and* per identifier. A 429 is
 * correct server behaviour, not a product defect, so back off and retry rather
 * than reporting a false failure.
 */
async function loginAsAdmin(page: Page): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await gotoLogin(page);
    await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
    const result = await submitLogin(page);

    if (result.status === 429) {
      await page.waitForTimeout(20_000);
      continue;
    }

    expect(result.role, 'the slug-link suite requires an ADMIN account').toBe('ADMIN');
    return;
  }

  throw new Error('login stayed rate-limited (429) after 3 attempts');
}

test.describe('Slug links', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: DESKTOP });
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-SL1: every list renders the entity name as a clickable control', async () => {
    for (const list of LISTS) {
      await openList(page, list.path);

      const nameLink = page.getByTestId(NAME_LINK).first();
      await expect(nameLink, `${list.label}: the name is not clickable`).toBeVisible();
      await expect(nameLink, `${list.label}: the name control is disabled`).toBeEnabled();

      const name = (await nameLink.innerText()).trim();
      expect(name, `${list.label}: the name control carries no text`).not.toBe('');

      console.log(`✅ ${list.label}: name "${name}" is clickable`);
    }
  });

  test('AC-SL1: clicking the name opens that entity, not the list', async () => {
    for (const list of LISTS) {
      await openList(page, list.path);

      // Navigate from the FIRST ROW: read its slug handle (plain text now, so
      // the row must be the source of truth for which slug should open).
      const firstRow = page
        .locator('tbody tr', { has: page.getByTestId(NAME_LINK) })
        .first();
      const slug = (await firstRow.getByTestId(SLUG_TEXT).innerText()).trim();
      expect(slug, `${list.label}: the first row has no slug handle`).not.toBe('');

      await firstRow.getByTestId(NAME_LINK).click();

      // The url pins WHICH entity opened — the slug is read from the same row
      // the link was clicked on, so a wrong-entity navigation cannot pass.
      await expect
        .poll(() => new URL(page.url()).pathname, {
          message: `${list.label}: clicking the name did not open ${list.path}/${slug}`,
        })
        .toBe(`${list.path}/${slug}`);

      // …and the detail view rendered. Every detail template prints the entity
      // slug, so a matching, visible slug proves arrival rather than a URL flip.
      await expect(
        page.getByText(slug, { exact: true }).first(),
        `${list.label}: the detail view for "${slug}" did not render`,
      ).toBeVisible();

      console.log(`✅ ${list.label}: row slug "${slug}" opened ${list.path}/${slug}`);
    }
  });

  test('AC-SL2: the categories trash tab keeps the row control absent', async () => {
    await openList(page, '/dashboard/categories');
    await expect(page.getByTestId(NAME_LINK).first()).toBeVisible();

    const trashTab = page.getByRole('tab', { name: /^Trash/ });
    // The tab carries the count badge ("Trash 3"). Wait for a digit rather than
    // for the em dash it renders before the count request resolves.
    await expect(trashTab).toContainText(/\d/);
    const trashCount = Number.parseInt((await trashTab.innerText()).replace(/\D+/g, ''), 10);

    await trashTab.click();
    await expect(trashTab, 'the trash tab did not become selected').toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page, 'switching to the trash tab is URL-backed').toHaveURL(/view=trash/);

    // With no trashed rows there is no slug to inspect, so this rule cannot be
    // exercised at all. Skipping says so out loud; asserting "0 controls" over an
    // empty table would pass forever and prove nothing.
    test.skip(
      trashCount === 0,
      'categories trash holds no rows — nothing to prove the row control stays absent',
    );

    // Trashed rows are unreachable by design (the detail queries hide them and
    // `goToDetail()` refuses to route), so nothing may pretend to be a link out.
    await expect(page.locator('table tbody tr').first()).toBeVisible();
    await expect(
      page.getByTestId(NAME_LINK),
      'the trash tab renders a name control that cannot navigate',
    ).toHaveCount(0);

    console.log(`✅ categories trash: ${trashCount} trashed row(s), 0 name controls`);
  });
});
