import { expect, test } from '@playwright/test';

/**
 * P5 + P6 — the products list and the category detail page.
 *
 * P5: a filled Featured star is copper, and the price column uses the shared
 * range formatter (the currency appears once per range).
 * P6: the category page reads the same status mapper as the products list, the
 * dates and prices use the shared helpers, the image card is at most 320px at
 * 4:3, Back is a 36px ghost icon button, Move to trash is destructive and
 * confirms by name, and the table→pager gap is 16px.
 */

const EMAIL = process.env['E2E_ADMIN_EMAIL']!;
const PASSWORD = process.env['E2E_ADMIN_PASSWORD']!;

test.use({ viewport: { width: 1440, height: 900 } });

test('P5/P6 products list and category detail', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#identifier').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.waitForTimeout(800);

  await test.step('P5: the filled featured star is copper', async () => {
    await page.goto('/dashboard/products');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(800);

    const filled = page.locator('main td[data-column="featured"] ng-icon[name="heroStarSolid"]').first();
    await expect(filled).toBeVisible();
    const fill = await filled.evaluate((el) => getComputedStyle(el).color);
    expect(fill).toBe('rgb(138, 75, 34)');
  });

  await test.step('P5: the price column uses the shared range formatter', async () => {
    const prices = await page
      .locator('main td[data-column="productPrice"]')
      .allTextContents();
    expect(prices.length).toBeGreaterThan(0);
    for (const price of prices) {
      const text = price.replace(/[\u2066\u2069]/g, '').replace(/\s+/g, ' ').trim();
      // Range: "EGP 450.00 – 954.00" — one currency code, shared formatter.
      expect(text).toMatch(/^EGP [\d,]+\.\d{2} – [\d,]+\.\d{2}$|^EGP [\d,]+\.\d{2}$/);
    }
  });

  await test.step('P6: the category status matches the products list for every product', async () => {
    const names = await page
      .locator('main td[data-column="main_en"]')
      .evaluateAll((cells) => cells.map((c) => (c.textContent ?? '').trim()));
    const listStatuses = new Map<string, string>();
    const rows = page.locator('main tbody tr');
    for (let i = 0; i < (await rows.count()); i++) {
      const name = (await rows.nth(i).locator('td[data-column="main_en"]').innerText()).split('\n')[0].trim();
      const status = (await rows.nth(i).locator('td[data-column="isActive"]').innerText()).trim();
      listStatuses.set(name, status);
    }
    expect(names.length).toBeGreaterThan(0);

    await page.goto('/dashboard/categories/coffee');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(1200);
    const catRows = page.locator('main app-data-table tbody tr');
    const compared: { name: string; list: string; category: string }[] = [];
    for (let i = 0; i < (await catRows.count()); i++) {
      const name = (await catRows.nth(i).locator('td[data-column="main_en"]').innerText()).split('\n')[0].trim();
      const status = (await catRows.nth(i).locator('td[data-column="isActive"]').innerText()).trim();
      compared.push({ name, list: listStatuses.get(name) ?? 'missing', category: status });
    }
    expect(compared.length).toBe(4);
    for (const row of compared) {
      expect(row.category, `${row.name} status`).toBe(row.list);
      expect(row.category).toMatch(/Enabled|Disabled/);
    }
    // Every seeded product in this category is enabled on both surfaces.
    expect(compared.every((r) => r.category === 'Enabled')).toBe(true);
  });

  await test.step('P6: the deletion date and price use the shared formatters', async () => {
    const details = page.locator('main hlm-card').filter({ hasText: 'Details' });
    // Short month + time: the parts are flex spans, so the flattened text has
    // no spaces between them, but there is a comma and a 12-hour clock.
    await expect(details).toContainText(/,/);
    await expect(details).toContainText(/AM|PM/);
    await expect(details).not.toContainText(
      /January|February|March|April|June|July|August|September|October|November|December/,
    );

    const prices = await page.locator('main app-data-table td[data-column="price"]').allTextContents();
    for (const price of prices) {
      const text = price.replace(/[\u2066\u2069]/g, '').replace(/\s+/g, ' ').trim();
      expect(text).toMatch(/^EGP [\d,]+\.\d{2} – [\d,]+\.\d{2}$|^EGP [\d,]+\.\d{2}$/);
    }
  });

  await test.step('P6: image card is 320px max at 4:3 and Back is a 36px icon', async () => {
    const card = page.locator('main hlm-card').first();
    const box = (await card.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(320.5);
    expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.06);

    const back = page.locator('main button[aria-label="Back"]').first();
    const backBox = (await back.boundingBox())!;
    expect(Math.round(backBox.width)).toBe(36);
    expect(Math.round(backBox.height)).toBe(36);
    await expect(back).toHaveText('');
  });

  await test.step('P6: Move to trash is destructive and confirms by name', async () => {
    const trashButton = page.locator('main button').filter({ hasText: 'Move to trash' }).first();
    const color = await trashButton.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(184, 50, 50)');
    await trashButton.click();
    const confirm = page.locator('[role="alertdialog"]');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('Coffee');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
  });

  await test.step('P6: table and pagination are 16px apart', async () => {
    const table = page.locator('main app-data-table table').first();
    const pager = page.locator('main app-pager').first();
    const tableBox = (await table.boundingBox())!;
    const pagerBox = (await pager.boundingBox())!;
    expect(Math.round(pagerBox.y - (tableBox.y + tableBox.height))).toBe(16);
  });
});
