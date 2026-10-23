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
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#identifier', { state: 'visible', timeout: 60000 });
  await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
  await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
  const response = page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
  await page.click('button[type="submit"]');
  await response;
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}
if (!(await sessionIsLive())) await login();
await page.goto(`${BASE}/dashboard/users/1?x=${Date.now()}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
const txt = await page.locator('body').innerText();
console.log(txt.includes('Change role') ? 'HAS Change role' : 'NO Change role');
console.log(txt.includes('Manage') ? 'HAS Manage' : 'NO Manage');
await page.screenshot({ path: '/tmp/opencode/userdetail.png' });
await browser.close();
