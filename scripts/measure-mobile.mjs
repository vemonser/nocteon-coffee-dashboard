import { chromium } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import fs from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';

async function login(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(BASE + '/login');
    await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
    await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
    const respPromise = page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
    await page.click('button[type="submit"]');
    const resp = await respPromise;
    if (resp.status() === 429) { await page.waitForTimeout(20000); continue; }
    if (resp.ok()) { await page.waitForURL('**/dashboard', { timeout: 15000 }); return; }
    throw new Error(`login failed: ${resp.status()}`);
  }
  throw new Error('rate limited');
}

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();
await login(page);
await page.evaluate(() => { localStorage.setItem('language','en'); localStorage.setItem('nocteon-theme','light'); });
await page.goto(BASE + '/dashboard/orders', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const data = await page.evaluate(() => {
  const out = {};
  out.overflowEls = [...document.querySelectorAll('*')]
    .filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
    .slice(0, 30).map(e => ({ tag: e.tagName, cls: (e.className||'').toString().slice(0,100), right: Math.round(e.getBoundingClientRect().right), w: Math.round(e.getBoundingClientRect().width) }));
  out.table = document.querySelector('table') ? {
    scrollWidth: document.querySelector('table').scrollWidth,
    clientWidth: document.querySelector('table').clientWidth,
    wrapperScrollWidth: document.querySelector('.overflow-x-auto')?.scrollWidth,
    wrapperClientWidth: document.querySelector('.overflow-x-auto')?.clientWidth,
  } : null;
  out.filterTabs = [...document.querySelectorAll('button')].filter(b => /ALL|Pending|Confirmed/i.test(b.textContent)).map(b => ({ text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) }));
  out.searchH = Math.round(document.querySelector('input[type="search"]')?.getBoundingClientRect().height || 0);
  out.statsCardsVisible = [...document.querySelectorAll('.grid')].map(g => ({ cols: getComputedStyle(g).gridTemplateColumns, childCount: g.children.length }));
  out.buttonsSmall = [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height < 44).length;
  out.totalButtons = document.querySelectorAll('button').length;
  return out;
});
fs.writeFileSync('/tmp/rev-evidence/mobile375.json', JSON.stringify(data, null, 2));
console.log(JSON.stringify(data, null, 2).slice(0,1500));
await context.close();
await browser.close();
