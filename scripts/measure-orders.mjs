import { chromium } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import fs from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const OUT = '/tmp/rev-evidence';

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

for (const [lang, theme] of [['ar','light'],['en','dark']]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await login(page);
  await page.evaluate(([l,t]) => { localStorage.setItem('language', l); localStorage.setItem('nocteon-theme', t); }, [lang, theme]);
  await page.goto(BASE + '/dashboard/orders', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const out = {};
    // overflow
    out.overflowEls = [...document.querySelectorAll('*')]
      .filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 20).map(e => ({ tag: e.tagName, cls: (e.className||'').toString().slice(0,80), right: Math.round(e.getBoundingClientRect().right) }));
    // distinct counts
    const props = ['font-size','font-family','border-radius','box-shadow','padding','color'];
    out.distinct = {};
    for (const p of props) {
      const vals = [...new Set([...document.querySelectorAll('*')].map(e => getComputedStyle(e)[p]))].filter(v => v && v !== 'none' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)');
      out.distinct[p] = { count: vals.length, values: vals.slice(0,40) };
    }
    // table
    const table = document.querySelector('table');
    out.table = table ? {
      width: Math.round(table.getBoundingClientRect().width),
      ths: [...table.querySelectorAll('thead th')].map(th => ({
        text: th.textContent.trim(),
        width: Math.round(th.getBoundingClientRect().width),
        textAlign: getComputedStyle(th).textAlign,
        fontSize: getComputedStyle(th).fontSize,
        fontWeight: getComputedStyle(th).fontWeight,
        textTransform: getComputedStyle(th).textTransform,
        padding: getComputedStyle(th).padding,
      })),
      rowCount: document.querySelectorAll('tbody tr').length,
      firstRowCells: table.querySelector('tbody tr') ? [...table.querySelector('tbody tr').querySelectorAll('td')].map(td => ({
        text: td.textContent.trim().slice(0,60),
        textAlign: getComputedStyle(td).textAlign,
        fontSize: getComputedStyle(td).fontSize,
        fontVariantNumeric: getComputedStyle(td).fontVariantNumeric,
        width: Math.round(td.getBoundingClientRect().width),
      })) : [],
    } : null;
    // search input
    const search = document.querySelector('input[type="search"]');
    out.search = search ? {
      placeholder: search.getAttribute('placeholder'),
      ariaLabel: search.getAttribute('aria-label'),
      height: Math.round(search.getBoundingClientRect().height),
      fontSize: getComputedStyle(search).fontSize,
      padding: getComputedStyle(search).padding,
    } : null;
    // filter tabs
    out.filterTabs = [...document.querySelectorAll('button')].filter(b => /ALL|PENDING|CONFIRMED|PROCESSING|SHIPPED|DELIVERED|CANCELLED|الكل/i.test(b.textContent)).map(b => ({
      text: b.textContent.trim(),
      height: Math.round(b.getBoundingClientRect().height),
      variant: b.getAttribute('data-variant') || b.className.includes('default') ? 'default' : 'outline',
    }));
    // stats cards
    out.statsCards = [...document.querySelectorAll('.grid > div, .grid > *')].slice(0,8).map(c => ({
      text: c.textContent.trim().slice(0,60),
      padding: getComputedStyle(c).padding,
      borderRadius: getComputedStyle(c).borderRadius,
    }));
    // loading skeleton present?
    out.hasSkeleton = !!document.querySelector('.animate-pulse');
    // empty state?
    out.emptyText = document.body.innerText.includes('No') ? 'maybe' : '';
    // headings
    out.headings = [...document.querySelectorAll('h1,h2,h3')].map(h => ({ tag: h.tagName, text: h.textContent.trim().slice(0,60), fontSize: getComputedStyle(h).fontSize }));
    // pager
    out.pager = document.querySelector('app-pager') ? document.querySelector('app-pager').outerHTML.slice(0,400) : null;
    // all buttons heights
    out.buttons = [...document.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().height));
    out.buttonDistinctHeights = [...new Set(out.buttons)];
    // focus outline check
    out.focusOutlineNone = [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => /outline\s*:\s*none/i.test(r.cssText)); } catch { return false; } });
    // main landmarks
    out.hasMain = !!document.querySelector('main');
    out.hasNav = !!document.querySelector('nav');
    out.hasHeader = !!document.querySelector('header');
    out.h1Count = document.querySelectorAll('h1').length;
    // status badges in table
    out.badges = [...document.querySelectorAll('tbody td span, tbody td [class*="badge"]')].slice(0,20).map(b => ({
      text: b.textContent.trim(),
      bg: getComputedStyle(b).backgroundColor,
      color: getComputedStyle(b).color,
      borderRadius: getComputedStyle(b).borderRadius,
      padding: getComputedStyle(b).padding,
      fontSize: getComputedStyle(b).fontSize,
    }));
    // action buttons in table
    out.actionBtns = [...document.querySelectorAll('tbody td:last-child button, tbody tr button')].map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      title: b.getAttribute('title'),
      text: b.textContent.trim().slice(0,30),
      height: Math.round(b.getBoundingClientRect().height),
      width: Math.round(b.getBoundingClientRect().width),
    }));
    return out;
  });

  fs.writeFileSync(`${OUT}/measurements-${lang}-${theme}.json`, JSON.stringify(data, null, 2));
  console.log(JSON.stringify({ overflow: data.overflowEls.length, distinct: Object.fromEntries(Object.entries(data.distinct).map(([k,v])=>[k,v.count])), tableThs: data.table?.ths.map(t=>t.text), badgeCount: data.badges.length, consoleErrors: errors.length }, null, 2));
  await context.close();
}

await browser.close();
console.log('done');
