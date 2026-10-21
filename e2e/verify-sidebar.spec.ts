import { test, expect } from '@playwright/test';

test('verify sidebar sections are all controllable', async ({ page, context }) => {
  test.setTimeout(180000);

  // Start from a clean session — a prior test may have left cookies behind.
  await context.clearCookies();
  await page.goto('http://localhost:4200/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Login — with 429 backoff. POST /api/auth/login is bucket-limited to 5/min
  // per IP and per identifier, and the whole E2E suite shares the bucket: the
  // spec(s) that ran before can drain it (same handling as verify-tables).
  let loggedIn = false;
  for (let attempt = 1; attempt <= 3 && !loggedIn; attempt++) {
    await page.waitForSelector('input[formControlName="identifier"]', { timeout: 10000 });
    await page.fill('input[formControlName="identifier"]', 'admin@aurum.local');
    await page.fill('input[formControlName="password"]', 'Admin@123');
    await page.click('button[type="submit"]');

    await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 30000 }),
      page.waitForSelector('p.text-destructive', { timeout: 30000 }),
    ]);
    loggedIn = page.url().includes('/dashboard');

    if (!loggedIn) {
      // The inline error is showing (rate limit or rejected creds). Only the
      // rate limit is expected here — wait out the bucket window and retry.
      await page.waitForTimeout(20_000);
      await page.reload();
    }
  }
  expect(loggedIn, 'login never reached the dashboard').toBe(true);

  const sectionChildren: Record<string, string[]> = {
    Operations: ['Orders', 'Carts', 'Users', 'Reviews', 'Contact Messages'],
    Content: ['Journal', 'Broadcasts', 'Notifications'],
    Catalog: ['Products', 'Product Options', 'Categories'],
    'Coffee data': [
      'Origins', 'Farms', 'Roast Levels', 'Processing Methods', 'Coffee Varieties',
      'Tasting Notes', 'Shipping Zones', 'Promo Codes', 'Brewing', 'Pairings',
    ],
    Settings: ['Store Settings'],
  };

  for (const [parent, children] of Object.entries(sectionChildren)) {
    // Collapse every section first so the sidebar never overflows
    for (const p of Object.keys(sectionChildren)) {
      const btn = page.locator(`button:has-text("${p}")`);
      if ((await btn.getAttribute('aria-expanded')) === 'true') {
        await btn.click();
        await page.waitForTimeout(300);
      }
    }

    // Expand the section under test
    const parentBtn = page.locator(`button:has-text("${parent}")`);
    await expect(parentBtn).toBeVisible({ timeout: 5000 });
    await parentBtn.click();
    await parentBtn.waitFor({ state: 'attached' });
    await page.waitForTimeout(300);

    // Verify every child — scroll into view first (sidebar is scrollable)
    for (const child of children) {
      const link = page.locator(`a:has-text("${child}")`).first();
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible({ timeout: 5000 });
    }
    console.log(`✅ ${parent} children visible`);
  }

  // All children are navigable links pointing at the real routes
  for (const route of [
    '/dashboard/origins', '/dashboard/farms', '/dashboard/roast-levels',
    '/dashboard/processing-methods', '/dashboard/coffee-varieties',
    '/dashboard/tasting-notes', '/dashboard/shipping-zones',
    '/dashboard/promo-codes', '/dashboard/brewing-methods', '/dashboard/pairings',
  ]) {
    const link = page.locator(`a[href="${route}"]`).first();
    await expect(link).toBeAttached({ timeout: 3000 });
  }

  // Regression guard for "expanded groups become unreachable".
  // hlm-sidebar-content is a flex column whose children default to
  // flex-shrink: 1, and .nav-collapse hides its overflow (so its automatic
  // minimum size is 0). With several groups open the children were squashed to
  // a few px, which kept nav.scrollHeight === nav.clientHeight: no scrollbar
  // appeared and the links inside those groups were clipped with no way to
  // reach them. Open EVERY group at once and prove the nav really scrolls.
  for (const p of Object.keys(sectionChildren)) {
    const btn = page.locator(`button:has-text("${p}")`).first();
    if ((await btn.getAttribute('aria-expanded')) === 'false') {
      await btn.click();
      await page.waitForTimeout(200);
    }
  }
  await page.waitForTimeout(500);

  const navMetrics = await page.evaluate(() => {
    const nav = document.querySelector('hlm-sidebar-content');
    if (!nav) {
      return null;
    }
    const squashedChildren = Array.from(nav.children).filter(
      (child) => child.clientHeight + 1 < child.scrollHeight,
    ).length;

    nav.scrollTop = nav.scrollHeight; // scroll all the way down
    const lastLink = Array.from(nav.querySelectorAll('a')).pop();
    const navRect = nav.getBoundingClientRect();
    const lastRect = lastLink?.getBoundingClientRect();
    nav.scrollTop = 0;

    return {
      overflowY: getComputedStyle(nav).overflowY,
      scrollable: nav.scrollHeight > nav.clientHeight + 1,
      squashedChildren,
      lastLabel: (lastLink?.textContent ?? '').trim(),
      lastLinkReachable:
        !!lastRect && lastRect.top >= navRect.top - 1 && lastRect.bottom <= navRect.bottom + 1,
    };
  });

  expect(navMetrics, 'sidebar nav should be present').not.toBeNull();
  expect(navMetrics?.overflowY).toBe('auto');
  expect(navMetrics?.scrollable, 'nav must scroll when every group is open').toBe(true);
  expect(
    navMetrics?.squashedChildren,
    'no nav child may be squashed below its content height',
  ).toBe(0);
  expect(
    navMetrics?.lastLinkReachable,
    `last link "${navMetrics?.lastLabel}" must be reachable by scrolling`,
  ).toBe(true);
  console.log(`✅ nav scrolls with all groups open (last link: ${navMetrics?.lastLabel})`);

  // RTL switch still works from the header avatar menu
  const userMenuBtn = page.locator('header hlm-avatar').first().locator('..');
  await userMenuBtn.click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Language")').first().click();
  await page.waitForTimeout(500);
  expect(await page.getAttribute('html', 'dir')).toBe('rtl');
  await expect(page.locator('button:has-text("العمليات")').first()).toBeVisible();

  console.log('✅ All verification passed!');
});
