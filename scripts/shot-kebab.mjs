// A screenshot probe: the reviews console with the row's kebab menu open.
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const BASE = 'http://localhost:4200';
const width = Number(process.argv[2] ?? 1440);
const lang = process.argv[3] ?? 'en';
const out = process.argv[4] ?? `/tmp/opencode/kebab-${width}-${lang}.png`;

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

await page.setViewportSize({ width, height: 900 });
await page.goto(`${BASE}/dashboard/reviews?view=list&status=pending`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
if (lang === 'ar') {
  await page.evaluate(() => localStorage.setItem('language', 'ar'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
}

const rows = await page.locator('tbody tr').count();
const last = page.locator('tbody tr').nth(rows - 1);
await last.locator('button[aria-haspopup="menu"], button[data-slot="dropdown-menu-trigger"]').first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: out });
console.log('shot ->', out, 'rows', rows);
console.log('table wrapper scrollLeft:', await page.evaluate(() => {
  const w = document.querySelector('.relative.overflow-x-auto');
  return w ? w.scrollLeft : null;
}));
console.log('kebab box:', await page.evaluate(() => {
  const k = document.querySelector('tbody tr:last-child button[aria-haspopup="menu"]');
  const r = k.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right) };
}));

await browser.close();
