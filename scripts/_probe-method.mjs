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
async function login() {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
    await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
    const response = page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
    await page.click('button[type="submit"]');
    const resp = await response;
    if (resp.status() === 429) { await page.waitForTimeout(20000); continue; }
    if (resp.ok()) { await page.waitForURL('**/dashboard', { timeout: 20000 }); return; }
    throw new Error(`login failed: ${resp.status()}`);
  }
  throw new Error('rate limited');
}
await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
if (page.url().includes('/login')) await login();
await context.route('**/__evidence-seed', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }));
await page.goto(`${BASE}/__evidence-seed`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { localStorage.setItem('language', 'en'); localStorage.setItem('nocteon-theme', 'light'); });
await page.goto(`${BASE}/dashboard/orders`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
if (page.url().includes('/login')) { console.log('LOGIN NEEDED'); }
const out = await page.evaluate(() => {
  const table = document.querySelector('app-data-table table');
  const headers = Array.from(table.querySelectorAll('thead th')).map((th) => ({ text: (th.textContent||'').trim(), w: Math.round(th.getBoundingClientRect().width) }));
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  const methodCells = rows.map((row) => {
    const td = row.querySelectorAll('td')[6];
    if (!td) return null;
    const spans = Array.from(td.querySelectorAll('*')).map(e => ({ tag: e.tagName, t: (e.textContent||'').trim().slice(0,24), sw: e.scrollWidth, cw: e.clientWidth, ell: getComputedStyle(e).textOverflow, w: Math.round(e.getBoundingClientRect().width) }));
    return { text: (td.textContent||'').trim(), tdW: Math.round(td.getBoundingClientRect().width), spans };
  });
  const row = table.querySelector('tbody tr');
  const cells = Array.from(row.querySelectorAll('td')).map((td) => {
    const spans = Array.from(td.querySelectorAll('*')).filter(e => getComputedStyle(e).textOverflow === 'ellipsis');
    return { text: (td.textContent||'').trim().slice(0,30), w: Math.round(td.getBoundingClientRect().width),
      ell: spans.map(s => ({ t: (s.textContent||'').trim().slice(0,30), sw: s.scrollWidth, cw: s.clientWidth })) };
  });
  const container = table.parentElement;
  return { tableW: Math.round(table.getBoundingClientRect().width), minWidth: table.style.minWidth,
    containerW: container ? Math.round(container.getBoundingClientRect().width) : null,
    sum: headers.reduce((a, h) => a + h.w, 0),
    headers, cells, methodCells };
});
console.log(JSON.stringify(out, null, 1));
await context.storageState({ path: AUTH_STATE });
await context.close(); await browser.close();
