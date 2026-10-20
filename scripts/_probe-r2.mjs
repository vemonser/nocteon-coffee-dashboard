import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.route('**/__evidence-seed', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }));
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
const rp = page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
await page.click('button[type="submit"]');
const res = await rp;
if (!res.ok()) { console.log('login status', res.status()); }
await page.waitForTimeout(3000);
await page.goto(`${BASE}/__evidence-seed`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { localStorage.setItem('language','ar'); localStorage.setItem('nocteon-theme','dark'); });
await page.goto(`${BASE}/dashboard?days=30`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const out = await page.evaluate(() => {
  const res = {};
  res.lang = document.documentElement.lang;
  res.toggle = document.querySelector('button[hlmsidetrigger], button[hlmSidebarTrigger]')?.getAttribute('aria-label')
    ?? Array.from(document.querySelectorAll('button')).map(b=>b.getAttribute('aria-label')).filter(x=>x&&/sidebar/i.test(x));
  res.coffee = Array.from(document.querySelectorAll('li span.truncate')).map(e=>e.textContent.trim()).filter(t=>t==='Coffee');
  // nav items
  res.nav = Array.from(document.querySelectorAll('li a span.block.truncate, li a span.truncate.text-xs')).map(e=>e.textContent.trim()).slice(0,12);
  // axis labels
  res.axis = Array.from(document.querySelectorAll('svg text')).map(t=>t.textContent.trim()).filter(t=>t);
  res.donut = Array.from(document.querySelectorAll('[data-testid="donut-center-label"],[data-testid="donut-center-value"]')).map(t=>t.textContent.trim());
  res.kpi = Array.from(document.querySelectorAll('app-kpi-card')).map(c=>c.innerText.replace(/\n/g,' | '));
  res.device = document.querySelector('app-device-list')?.innerText.replace(/\n/g,' | ');
  res.summary = document.querySelector('app-revenue-chart')?.innerText.split('\n').slice(-3).join(' || ');
  return res;
});
console.log(JSON.stringify(out, null, 1));
await context.close(); await browser.close();
