// Which Latin words does the Arabic dashboard still show?
//
//   node scripts/scan-latin.mjs [url]
//
// It boots the app in Arabic and lists every Latin-script word on the
// page, with the element it came from. The words that are DATA (a product
// name, an order number, an e-mail) are listed separately from the words
// that are UI CHROME, because only the second kind is an i18n leak.
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const URL_PATH = process.argv[2] ?? '/dashboard?days=30';
const AUTH_STATE = resolve(process.cwd(), 'e2e/.auth/dashboard-admin.json');

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
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

await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
if (page.url().includes('/login')) await login();

await page.goto(`${BASE}/__evidence-seed`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('language', 'ar');
  localStorage.setItem('nocteon-theme', 'dark');
});
await page.goto(`${BASE}${URL_PATH}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const found = await page.evaluate(() => {
  const out = [];
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (!isVisible(el)) continue;
    // Only leaf-ish elements: the text of a container repeats its children.
    if (el.children.length > 0) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;
    const words = text.match(/[A-Za-z][A-Za-z'’-]*/g);
    if (!words) continue;
    const path = [];
    let node = el;
    for (let i = 0; i < 4 && node && node !== document.body; i += 1) {
      path.unshift(
        node.tagName.toLowerCase() +
          (node.className && typeof node.className === 'string'
            ? '.' + node.className.trim().split(/\s+/).slice(0, 2).join('.')
            : ''),
      );
      node = node.parentElement;
    }
    out.push({ words: [...new Set(words)], text: text.slice(0, 80), path: path.join(' > ') });
  }
  return out;
});

const byWord = new Map();
for (const row of found) {
  for (const w of row.words) {
    if (!byWord.has(w)) byWord.set(w, []);
    byWord.get(w).push(`${row.path}  ::  ${row.text}`);
  }
}
for (const [word, where] of [...byWord.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`\n${word}`);
  for (const w of where.slice(0, 4)) console.log(`   ${w}`);
}

await context.storageState({ path: AUTH_STATE });
await context.close();
await browser.close();
