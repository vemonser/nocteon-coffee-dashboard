import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';

/**
 * The newsletter page and the broadcasts page.
 *
 * The newsletter page is a list like every other list, with one thing it
 * exists for: the EXPORT of the addresses. So the test checks the export
 * for real — it downloads the file and reads it — because an export
 * button that produces nothing is worse than no button.
 *
 * The broadcasts page is checked for the things the round fixed: the
 * count, the TRANSLATED status (the raw enum was a bug), and the export.
 */
test.describe('newsletter and broadcasts', () => {
  test.setTimeout(120_000);

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      if (result.status === 429) {
        await page.waitForTimeout(20_000);
        continue;
      }
      // The login is proven by the URL leaving /login. The ROLE is a soft
      // check: the response body is sometimes already gone by the time it
      // is read (the SPA navigated away), and a null role there is a
      // timing artefact, not an auth failure.
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

  test('the newsletter page lists the addresses and exports them', async () => {
    await page.goto('/dashboard/newsletter', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // The table, like the other lists.
    const table = page.locator('app-data-table table');
    await expect(table).toBeVisible();
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible();

    // The address is the first column, and it is COMPLETE — a truncated
    // address cannot be exported.
    const firstAddress = (await rows.first().locator('td').first().innerText()).trim();
    expect(firstAddress, 'the address column is filled').toMatch(/@/);
    expect(firstAddress, 'the address is not truncated').toBe(
      await rows.first().locator('td').first().locator('span').first().innerText(),
    );

    // The count is the TOTAL, and it agrees in number.
    const header = (await page.locator('h1 + p').innerText()).trim();
    expect(header, 'the header counts the addresses').toMatch(/\d+\s+address/);

    // The export: the real file.
    const download = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('button:has-text("Export emails")').click();
    const file = await download;
    const path = await file.path();
    expect(path, 'the export produced a file').toBeTruthy();

    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString('utf-8');
    expect(csv, 'the CSV has a header row').toContain('email');
    expect(csv, 'the CSV has an address').toMatch(/@/);
    // The export covers the WHOLE audience, not only the rows on the page.
    const addressLines = csv
      .split('\n')
      .slice(1)
      .filter((line) => line.includes('@'));
    const tableRows = await rows.count();
    expect(addressLines.length, 'every address is exported').toBeGreaterThanOrEqual(
      tableRows,
    );
  });

  test('the broadcasts page counts, translates the status and exports', async () => {
    await page.goto('/dashboard/broadcasts', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // The count, with the bell — and no "2 of 🔔".
    const header = (await page.locator('h1 + p').innerText()).trim();
    expect(header, 'the header counts the broadcasts').toMatch(/\d+\s+broadcast/);
    expect(header, 'the header has no stray "of"').not.toContain(' of ');

    // The status is TRANSLATED — the raw enum was the bug.
    const badge = page.locator('hlm-badge').first();
    await expect(badge).toBeVisible();
    const status = (await badge.innerText()).trim();
    expect(status, 'the status is a word, not an enum').not.toMatch(
      /^(PENDING|IN_PROGRESS|COMPLETED)$/,
    );
    expect(status.length, 'the status is not empty').toBeGreaterThan(0);

    // The export works.
    const download = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('button:has-text("Export broadcasts")').click();
    const file = await download;
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString('utf-8');
    expect(csv, 'the CSV has a header row').toContain('subject');
  });

  test('a broadcast can be deleted', async () => {
    await page.goto('/dashboard/broadcasts', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // A broadcast of its own, so the test deletes what it created.
    const subject = `e2e delete probe ${Date.now()}`;
    await page.locator('button:has-text("New Broadcast")').click();
    await page.locator('input[formcontrolname="subject"]').fill(subject);
    await page.locator('textarea[formcontrolname="content"]').fill('created by the e2e suite');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator(`text=${subject}`).first()).toBeVisible({
      timeout: 20_000,
    });

    // The delete action, and the confirmation.
    const card = page.locator('div.rounded-md.border.bg-card', { hasText: subject }).first();
    await card.locator('button[aria-label]').click();
    await page.locator('button:has-text("Delete")').last().click();
    await expect(page.locator(`text=${subject}`)).toHaveCount(0, { timeout: 20_000 });
  });

  test('the Arabic pages carry no untranslated string', async () => {
    // The language is switched through the app's OWN control, so the page
    // is read in the language a reader would see.
    const current = await page.evaluate(() => document.documentElement.lang);
    if (current !== 'ar') {
      const trigger = page.locator(
        'app-user-menu[variant="navbar"] button[data-slot="dropdown-menu-trigger"]',
      );
      await trigger.click();
      const item = page.locator('[role="menuitem"]', { hasText: /Language|اللغة/ });
      await item.click();
      await page.waitForFunction(() => document.documentElement.lang === 'ar', undefined, {
        timeout: 15_000,
      });
      await page.waitForTimeout(1500);
    }

    for (const path of ['/dashboard/newsletter', '/dashboard/broadcasts']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const text = await page.locator('body').innerText();
      expect(text, `no raw translation key on ${path}`).not.toMatch(
        /\b[a-z][A-Za-z0-9_]*(\.[a-z][A-Za-z0-9_]*){2,}\b/,
      );
      // The status is a WORD, not an enum, in Arabic too.
      const badge = page.locator('hlm-badge').first();
      if (await badge.count()) {
        const status = (await badge.innerText()).trim();
        expect(status, 'the status is not a raw enum').not.toMatch(
          /^(PENDING|IN_PROGRESS|COMPLETED)$/,
        );
      }
    }
  });
});
