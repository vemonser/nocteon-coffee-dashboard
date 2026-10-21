// A probe for the row's kebab menu: does it stay inside the viewport, and
// does it layer above the row below? The click is a REAL Playwright click,
// so the measurement is the one a user would get.
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const BASE = 'http://localhost:4200';

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
const resp = page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
await page.click('button[type="submit"]');
await resp;
await page.waitForTimeout(2500);
await context.storageState({ path: 'e2e/.auth/dashboard-admin.json' });

const MEASURE = () => {
  const menu = Array.from(document.querySelectorAll('[data-slot="dropdown-menu"]')).find(
    (m) => m.getBoundingClientRect().width > 0 && m.getBoundingClientRect().height > 0,
  );
  if (!menu) return { error: 'no visible menu' };
  const m = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).map((i) =>
    (i.textContent || '').trim(),
  );
  // Every button that sits UNDER the menu's rectangle.
  const covered = Array.from(document.querySelectorAll('tbody button')).filter((b) => {
    const r = b.getBoundingClientRect();
    return r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top;
  });
  // Of those, the ones the menu is actually ON TOP of.
  const onTop = covered.filter((b) => {
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(
      Math.round((Math.max(r.left, m.left) + Math.min(r.right, m.right)) / 2),
      Math.round((Math.max(r.top, m.top) + Math.min(r.bottom, m.bottom)) / 2),
    );
    return !!el?.closest('[data-slot="dropdown-menu"]');
  });
  return {
    menu: {
      left: Math.round(m.left),
      right: Math.round(m.right),
      top: Math.round(m.top),
      bottom: Math.round(m.bottom),
    },
    viewport: { w: vw, h: vh },
    insideViewport: m.left >= 0 && m.right <= vw && m.top >= 0 && m.bottom <= vh,
    clippedRightPx: Math.round(Math.max(0, m.right - vw)),
    clippedBottomPx: Math.round(Math.max(0, m.bottom - vh)),
    coveredButtons: covered.length,
    menuOnTopOf: onTop.length,
    menuUnderneath: covered.length - onTop.length,
    items,
  };
};

for (const width of [1920, 1440, 1280, 1024]) {
  for (const lang of ['en', 'ar']) {
    await page.setViewportSize({ width, height: 900 });
    // The language is persisted in localStorage, so it is seeded BEFORE the
    // app boots — a reload would be a second app load, and the backend
    // revokes the token family when the same refresh cookie is presented
    // twice. `addInitScript` seeds it without booting the app twice.
    await page.addInitScript(
      (l) => {
        try {
          localStorage.setItem('language', l);
        } catch {
          /* the origin is not ready yet */
        }
      },
      lang,
    );
    await page.goto(`${BASE}/dashboard/reviews?view=list&status=pending`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const rowCount = await page.locator('tbody tr').count();
    const results = [];
    for (const which of ['last', 'middle']) {
      const index = which === 'last' ? rowCount - 1 : Math.max(0, Math.floor(rowCount / 2));
      const row = page.locator('tbody tr').nth(index);
      await row
        .locator('button[aria-haspopup="menu"], button[data-slot="dropdown-menu-trigger"]')
        .first()
        .click();
      await page.waitForTimeout(700);
      const measured = await page.evaluate(MEASURE);
      results.push({ which, rowIndex: index, ...measured });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    console.log(width, lang, JSON.stringify(results));
  }
}

await browser.close();
