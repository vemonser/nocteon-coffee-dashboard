// A quick look at a page: log in once, open the routes, screenshot.
//   node scripts/shot.mjs <name> <url> [width] [lang] [theme]
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';

const name = process.argv[2] ?? 'shot';
const url = process.argv[3] ?? '/dashboard/orders';
const width = Number(process.argv[4] ?? 1440);
const lang = process.argv[5] ?? 'en';
const theme = process.argv[6] ?? 'light';

const OUT = resolve(process.cwd(), 'evidence', 'shots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
const rp = page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
await page.click('button[type="submit"]');
await rp;
await page.waitForURL('**/dashboard', { timeout: 20_000 });

await page.goto(`${BASE}/__seed`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.evaluate(
  ([l, t]) => {
    localStorage.setItem('language', l);
    localStorage.setItem('nocteon-theme', t);
  },
  [lang, theme],
);

await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const file = `${OUT}/${name}-${lang}-${theme}-${width}.png`;
await page.screenshot({ path: file, fullPage: true });
console.log('shot ->', file);
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.join('\n'));
else console.log('no console errors');

await browser.close();
