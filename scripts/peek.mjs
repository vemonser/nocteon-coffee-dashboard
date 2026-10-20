// A quick look at a page, reusing the cached login session.
//
//   node scripts/peek.mjs <name> <url> [width] [lang] [theme] [full]
//
// The cached storageState (e2e/.auth/dashboard-admin.json) is replayed
// instead of logging in again: the backend rate-limits the login to 5/min
// and rotates the refresh cookie on every use.
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';

const name = process.argv[2] ?? 'peek';
const url = process.argv[3] ?? '/dashboard?days=30';
const width = Number(process.argv[4] ?? 1440);
const lang = process.argv[5] ?? 'en';
const theme = process.argv[6] ?? 'light';
const full = process.argv[7] !== 'viewport';

const OUT = resolve(process.cwd(), 'evidence', 'shots');
mkdirSync(OUT, { recursive: true });
const AUTH_STATE = resolve(process.cwd(), 'e2e/.auth/dashboard-admin.json');

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({
  viewport: { width, height: 900 },
  ...(existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}),
});

await context.route('**/__evidence-seed', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><head><title>seed</title></head><body></body></html>',
  }),
);

const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// The cached session may be dead: the backend ROTATES the refresh cookie
// on every refresh, so a state file that was used once cannot be replayed
// a second time. Fall back to a real login (rate-limited, so it waits out
// a 429) and re-save the state at the end of the run.
async function sessionIsLive() {
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    return !page.url().includes('/login');
  } catch {
    return false;
  }
}

async function login() {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
    await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
    const response = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    );
    await page.click('button[type="submit"]');
    const resp = await response;
    if (resp.status() === 429) {
      await page.waitForTimeout(20_000);
      continue;
    }
    if (resp.ok()) {
      await page.waitForURL('**/dashboard', { timeout: 20_000 });
      return;
    }
    throw new Error(`login failed: ${resp.status()}`);
  }
  throw new Error('login stayed rate-limited (429) after 4 attempts');
}

if (!(await sessionIsLive())) {
  console.log('no valid cached session — logging in once');
  await login();
}

await page.goto(`${BASE}/__evidence-seed`, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ([l, t]) => {
    localStorage.setItem('language', l);
    localStorage.setItem('nocteon-theme', t);
  },
  [lang, theme],
);

await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const file = `${OUT}/${name}-${lang}-${theme}-${width}.png`;
await page.screenshot({ path: file, fullPage: full });
console.log('->', file);
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.join('\n'));

// Keep the session for the next capture: the refresh cookie was rotated.
await context.storageState({ path: AUTH_STATE });

await context.close();
await browser.close();
