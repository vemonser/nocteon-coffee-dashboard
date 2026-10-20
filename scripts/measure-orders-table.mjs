// Measure the orders list columns: the width of every column and every cell
// that is TRUNCATED (ellipsis) or CLIPPED.
//   node scripts/measure-orders-table.mjs [url]
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const url = process.argv[2] ?? '/dashboard/orders';

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
const rp = page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
await page.click('button[type="submit"]');
await rp;
await page.waitForURL('**/dashboard', { timeout: 20_000 });

await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const out = await page.evaluate(() => {
  const table = document.querySelector('app-data-table table');
  if (!table) return { error: 'no table' };
  const headers = Array.from(table.querySelectorAll('thead th')).map((th) => ({
    text: (th.textContent || '').trim().replace(/\s+/g, ' '),
    width: Math.round(th.getBoundingClientRect().width),
  }));
  const rows = Array.from(table.querySelectorAll('tbody tr'))
    .filter((tr) => !tr.hasAttribute('aria-hidden'))
    .slice(0, 3);
  const truncated = [];
  for (const tr of rows) {
    const tds = Array.from(tr.querySelectorAll('td'));
    tds.forEach((td, i) => {
      const el = td.querySelector('span, a, bdi');
      if (!el) return;
      const cs = getComputedStyle(el);
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
        truncated.push({
          column: headers[i]?.text ?? `#${i}`,
          text: (el.textContent || '').trim().slice(0, 40),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        });
      }
    });
  }
  const wrapper = table.parentElement;
  const perCell = Array.from(table.querySelectorAll('tbody tr')).slice(0, 1).flatMap((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td, i) => ({
      column: headers[i]?.text ?? `#${i}`,
      cellWidth: Math.round(td.getBoundingClientRect().width),
      tdScroll: td.scrollWidth,
      tdClient: td.clientWidth,
      innerScroll: td.querySelector('span, a')?.scrollWidth ?? 0,
      innerClient: td.querySelector('span, a')?.clientWidth ?? 0,
      text: (td.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24),
    })),
  );
  return {
    tableScroll: table.scrollWidth,
    tableClient: table.clientWidth,
    perCell,
    tableWidth: Math.round(table.getBoundingClientRect().width),
    wrapperWidth: Math.round(wrapper.getBoundingClientRect().width),
    horizontalScrollInsideTable: table.scrollWidth > table.clientWidth + 1,
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    headers,
    truncated,
  };
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
