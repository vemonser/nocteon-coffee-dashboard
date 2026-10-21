import { chromium } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

loadEnv({ path: resolve('/home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-dashboard/.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const OUT = '/tmp/rev-evidence';

async function login(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(BASE + '/login');
    await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
    await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    );
    await page.click('button[type="submit"]');
    const resp = await respPromise;
    if (resp.status() === 429) { await page.waitForTimeout(20000); continue; }
    if (resp.ok()) { await page.waitForURL('**/dashboard', { timeout: 15000 }); return; }
    throw new Error(`login failed: ${resp.status()}`);
  }
  throw new Error('rate limited');
}

async function applyCell(page, lang, theme) {
  await page.evaluate(([l,t]) => { localStorage.setItem('language', l); localStorage.setItem('nocteon-theme', t); }, [lang, theme]);
}

const browser = await chromium.launch({ channel: 'chromium' });

for (const vp of [{w:1440,h:900,label:'desktop'},{w:390,h:844,label:'mobile'}]) {
  const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await login(page);
  for (const [lang, theme] of [['en','light'],['ar','light'],['en','dark']]) {
    await applyCell(page, lang, theme);
    await page.goto(BASE + '/dashboard/orders', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    // wait for table or loading
    try { await page.waitForSelector('table, [class*="rounded-md border"]', { timeout: 8000 }); } catch {}
    await page.waitForTimeout(1000);
    const name = `orders-${lang}-${theme}-${vp.label}`;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log('shot', name);
  }
  // save errors per viewport
  console.log(vp.label, 'console errors:', errors.length, errors.slice(0,5));
  await context.close();
}

await browser.close();
console.log('done');
