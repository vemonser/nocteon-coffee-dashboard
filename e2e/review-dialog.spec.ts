import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * The review DETAILS DIALOG.
 *
 * <p>These are the things the dialog itself promises — the title, the
 * footer hierarchy, the labelled status, the keyboard contract, and the
 * product link. The table and the grid have their own suite; nothing here
 * touches them.
 *
 * <p>ONE shared session, not one login per test: POST /api/auth/login is
 * rate limited to 5/minute per IP and per identifier, so logging in per
 * test rate-limits the suite against itself.
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

    expect(result.role, 'the suite requires an ADMIN account').toBe('ADMIN');
    return;
  }

  throw new Error('login stayed rate-limited (429) after 3 attempts');
}

/** The dialog panel of the shared DialogShell. */
const panel = '[data-testid="dialog-shell"]';

test.describe('the review details dialog', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    // The language is PINNED, not inherited: the spec asserts English
    // strings, and LanguageService falls back to navigator.language — so on
    // an Arabic machine every assertion would fail.
    await context.addInitScript(() => {
      localStorage.setItem('language', 'en');
      localStorage.setItem('nocteon-theme', 'light');
    });
    page = await context.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    await page.goto('/dashboard/reviews?status=approved&view=list');
    await expect(page.getByTestId('reviews-count')).toBeVisible();
    // The View button of the first row: the eye icon, in either language.
    await page.locator('tbody tr').first().locator('button:has(ng-icon[name="lucideEye"])').first().click();
    await expect(page.locator(panel)).toBeVisible();
  });

  test('the title is sentence case, like the rest of the app', async () => {
    await expect(page.locator(`${panel} h2`)).toHaveText('Review details');
  });

  test('the status is a LABELLED row, not a floating badge', async () => {
    const status = page.locator(`${panel} hlm-badge`).first();
    await expect(status).toBeVisible();
    // The label sits next to the badge, in the same row.
    const row = page.locator(`${panel} span:text-is("Status:")`).first();
    await expect(row).toBeVisible();
    const [labelBox, badgeBox] = await Promise.all([
      row.boundingBox(),
      status.boundingBox(),
    ]);
    expect(labelBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    // Same line: the badge is not below the label.
    expect(Math.abs(labelBox!.y - badgeBox!.y)).toBeLessThan(24);
  });

  test('the footer buttons have a gap and a hierarchy', async () => {
    const buttons = page.locator(`${panel} footer button`);
    const close = page.locator(`${panel} footer button:has-text("Close")`).first();
    const action = page.locator(`${panel} footer button:has-text("Withdraw approval")`).first();
    await expect(close).toBeVisible();
    await expect(action).toBeVisible();

    const [closeBox, actionBox] = await Promise.all([close.boundingBox(), action.boundingBox()]);
    const gap = actionBox!.x - (closeBox!.x + closeBox!.width);
    expect(gap).toBeGreaterThanOrEqual(11);
    expect(gap).toBeLessThanOrEqual(16);

    // The hierarchy: Close is a ghost (no fill), the action is a filled
    // button. Two buttons that look the same are two buttons with no order.
    const background = await action.evaluate((el) => getComputedStyle(el).backgroundColor);
    const closeBackground = await close.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).not.toBe(closeBackground);
    expect(await buttons.count()).toBeGreaterThanOrEqual(3);
  });

  test('the product name links to the product page that EXISTS', async () => {
    const link = page.locator(`${panel} a[href*="/dashboard/products/"]`).first();
    await expect(link).toBeVisible();
    // /dashboard/products/:slug is not a route; the edit page is.
    await expect(link).toHaveAttribute('href', /\/dashboard\/products\/[^/]+\/edit$/);
  });

  test('the comment keeps its line breaks', async () => {
    const quote = page.locator(`${panel} blockquote`).first();
    await expect(quote).toBeVisible();
    const whiteSpace = await quote.evaluate((el) => getComputedStyle(el).whiteSpace);
    expect(whiteSpace).toContain('pre');
  });

  test('the rating shows the stars and the number next to them', async () => {
    const stars = page.locator(`${panel} app-rating-stars`).first();
    await expect(stars).toBeVisible();
    const rating = page.getByTestId('review-dialog-rating');
    await expect(rating).toHaveText(/^\d+ \/ 5$/);
    // The number sits NEXT to the stars, on the same line.
    const [starsBox, ratingBox] = await Promise.all([stars.boundingBox(), rating.boundingBox()]);
    expect(Math.abs(starsBox!.y - ratingBox!.y)).toBeLessThan(24);
    // The screen reader gets a TRANSLATED label, not the shared component's
    // English one and not a raw key.
    await expect(page.locator(`${panel} .sr-only`).first()).toHaveText(/Rating: \d+ out of 5/);
    // The stars are the LARGE ones (24px), not the shared 16px.
    const starWidth = await page
      .locator(`${panel} app-rating-stars svg`)
      .first()
      .evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(starWidth).toBeGreaterThanOrEqual(24);
  });

  test('the focus stays INSIDE the dialog', async () => {
    const closeX = page.locator(`${panel} header button`).first();
    const last = page.locator(`${panel} footer button`).last();

    // Tab from the last control wraps to the first one.
    await last.focus();
    await page.keyboard.press('Tab');
    await expect(closeX).toBeFocused();

    // And Shift+Tab from the first one wraps back to the last.
    await closeX.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(last).toBeFocused();
  });

  test('approving toasts, and the button waits for the answer', async () => {
    // The PATCH is held, so the in-flight state is observable.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/dashboard/reviews/*/approval*', async (route) => {
      await held;
      await route.continue();
    });

    const approve = page.locator(`${panel} footer button:has-text("Approve")`).first();
    await approve.click();

    // The button is disabled and says what it is doing.
    await expect(approve).toBeDisabled();
    await expect(approve).toHaveText(/Approving/);

    release();
    await page.unroute('**/api/dashboard/reviews/*/approval*');
    await expect(page.getByText('Review approved').first()).toBeVisible();

    // Put the review back where it was: the suite must not change the seed.
    const withdraw = page.locator(`${panel} footer button:has-text("Withdraw approval")`).first();
    await expect(withdraw).toBeVisible();
    await withdraw.click();
    await expect(page.getByText('Approval withdrawn').first()).toBeVisible();
  });

  test('closing the dialog while the request is in flight does NOT re-open it', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/dashboard/reviews/*/approval*', async (route) => {
      await held;
      await route.continue();
    });

    await page.locator(`${panel} footer button:has-text("Approve")`).first().click();
    await page.keyboard.press('Escape');
    await expect(page.locator(panel)).toBeHidden();

    release();
    await page.unroute('**/api/dashboard/reviews/*/approval*');
    await page.waitForTimeout(1200);
    // The response landed — and the dialog stayed closed.
    await expect(page.locator(panel)).toBeHidden();
  });

  test('Escape closes the dialog and the focus returns to the trigger', async () => {
    const trigger = page.locator('tbody tr').first().locator('button:has(ng-icon[name="lucideEye"])').first();
    await page.keyboard.press('Escape');
    await expect(page.locator(panel)).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('the delete confirmation NAMES the review', async () => {
    await page.locator(`${panel} footer button:has-text("Delete")`).first().click();
    const confirm = page.locator('[data-testid="review-delete-confirm"]');
    await expect(confirm).toBeVisible();
    await expect(confirm.locator('h2')).toHaveText('Delete review');
    // The description names the review: the product and its reviewer.
    await expect(confirm.locator('#review-delete-confirm-description')).toContainText(/[()]/);
    // The consequence is announced with the question, not after it.
    await expect(confirm).toHaveAttribute('aria-describedby', 'review-delete-confirm-description');
    // The dialog behind it is inert: its buttons must not be reachable.
    const details = page.locator(panel).first();
    await expect(details).toHaveAttribute('inert', '');
  });

  test('in Arabic the footer is mirrored and the numerals still read "N / 5"', async () => {
    await page.evaluate(() => localStorage.setItem('language', 'ar'));
    await page.reload();
    await expect(page.getByTestId('reviews-count')).toBeVisible();
    await page
      .locator('tbody tr')
      .first()
      .locator('button:has(ng-icon[name="lucideEye"])')
      .first()
      .click();
    await expect(page.locator(panel)).toBeVisible();

    // The numerals read the same in both directions.
    await expect(page.getByTestId('review-dialog-rating')).toHaveText(/^\d+ \/ 5$/);

    // The footer is mirrored: Delete (the start side) is on the RIGHT.
    const deleteBox = await page.locator(`${panel} footer button:has-text("حذف")`).first().boundingBox();
    const actionBox = await page.locator(`${panel} footer button`).last().boundingBox();
    expect(deleteBox!.x).toBeGreaterThan(actionBox!.x);

    // The stars fill from the start side: the first star is the rightmost.
    const stars = await page.locator(`${panel} app-rating-stars svg`).evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)),
    );
    expect(stars[0]).toBeGreaterThan(stars[stars.length - 1]);
  });
});
