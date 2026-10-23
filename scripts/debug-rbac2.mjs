import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const AUTH_STATE = resolve(process.cwd(), 'e2e/.auth/dashboard-admin.json');
const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}) });
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
if (!(await sessionIsLive())) await login();

await page.goto(`${BASE}/dashboard/users`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.locator('tr', { hasText: 'admin@aurum.local' }).first().click();
await page.waitForTimeout(3000);
console.log('user view url', page.url());
const changeBtn = page.locator('button', { hasText: /Change role/i });
console.log('change btn count', await changeBtn.count());
if (await changeBtn.count()) console.log('disabled', await changeBtn.first().getAttribute('disabled'));

await page.goto(`${BASE}/dashboard/users/roles`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
console.log('role cards', await page.locator('button.card-surface').count());
console.log('matrix', await page.locator('app-permission-matrix').count());
console.log('body snippet', (await page.locator('body').innerText()).slice(0,300));
await browser.close();
