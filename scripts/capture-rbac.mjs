import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const OUT = resolve(process.cwd(), 'evidence', 'rbac', 'pass1');
mkdirSync(OUT, { recursive: true });
const AUTH_STATE = resolve(process.cwd(), 'e2e/.auth/dashboard-admin.json');

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}) });
await context.route('**/__evidence-seed', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
const page = await context.newPage();

async function sessionIsLive() { try { await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2000); return !page.url().includes('/login'); } catch { return false; } }
async function login() {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#identifier', { state: 'visible', timeout: 60000 });
    await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
    await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
    const response = page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
    await page.click('button[type="submit"]');
    const resp = await response;
    if (resp.status() === 429) { await page.waitForTimeout(20000); continue; }
    if (resp.ok()) { await page.waitForURL('**/dashboard', { timeout: 20000 }); return; }
    throw new Error(`login failed: ${resp.status()}`);
  }
  throw new Error('login rate limited');
}
if (!(await sessionIsLive())) { console.log('logging in'); await login(); }

async function seed(lang, theme) {
  await page.goto(`${BASE}/__evidence-seed`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([l,t]) => { localStorage.setItem('language', l); localStorage.setItem('nocteon-theme', t); }, [lang, theme]);
}
async function shot(name) { await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); }

const combos = [
  { lang: 'en', theme: 'light', suffix: 'light-en' },
  { lang: 'en', theme: 'dark', suffix: 'dark-en' },
  { lang: 'ar', theme: 'light', suffix: 'light-ar' },
];

for (const c of combos) {
  await seed(c.lang, c.theme);
  await page.goto(`${BASE}/dashboard/users`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const row = page.locator('tr', { hasText: /admin@aurum.local/ }).first();
  if (await row.count()) { await row.click(); await page.waitForTimeout(2000); }
  await shot(`user-view-admin-${c.suffix}`);

  const changeBtn = page.locator('button', { hasText: /Change role|تغيير الدور/ }).first();
  if (await changeBtn.count()) { await changeBtn.click(); await page.waitForTimeout(1000); }
  await shot(`change-role-dialog-${c.suffix}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await page.goto(`${BASE}/dashboard/users/roles`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await shot(`roles-list-${c.suffix}`);

  const roleBtn = page.locator('button.card-surface').first();
  if (await roleBtn.count()) { await roleBtn.click(); await page.waitForTimeout(1500); }
  await shot(`role-editor-matrix-${c.suffix}`);
}

await context.storageState({ path: AUTH_STATE });
await context.close();
await browser.close();
console.log('done');
