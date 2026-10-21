// A probe for the reviews console: logs in, then measures the table and the
// grid at a set of widths. Used while the fixes are being made; the
// committed proof is the evidence harness and the Playwright suite.
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const BASE = 'http://localhost:4200';

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
const resp = page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
await page.click('button[type="submit"]');
await resp;
await page.waitForTimeout(2500);
await context.storageState({ path: 'e2e/.auth/dashboard-admin.json' });

const LANG = process.argv[2] ?? 'en';

for (const width of [1920, 1440, 1280, 1024]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${BASE}/dashboard/reviews?view=list&status=all`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  if (LANG === 'ar') {
    await page.evaluate(() => localStorage.setItem('language', 'ar'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  }

  const out = await page.evaluate(() => {
    const table = document.querySelector('app-data-table table');
    if (!table) return { error: 'no table' };
    const wrap = document.querySelector('.relative.overflow-x-auto');
    const ths = Array.from(table.querySelectorAll('thead th')).map((th) => {
      const inner = th.querySelector('span.block.truncate') || th.querySelector('button > span');
      return {
        text: (th.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26),
        w: Math.round(th.getBoundingClientRect().width),
        h: Math.round(th.getBoundingClientRect().height),
        innerW: inner ? Math.round(inner.getBoundingClientRect().width) : null,
        innerScrollW: inner ? inner.scrollWidth : null,
        wrapped: inner ? inner.scrollHeight > inner.clientHeight + 1 : null,
      };
    });
    return {
      lang: document.documentElement.lang,
      tableW: Math.round(table.getBoundingClientRect().width),
      wrapCW: wrap?.clientWidth,
      wrapSW: wrap?.scrollWidth,
      wrapChildren: Array.from(wrap?.children ?? []).map((c) => ({
        tag: c.tagName,
        cls: String(c.className).slice(0, 60),
        w: Math.round(c.getBoundingClientRect().width),
        pos: getComputedStyle(c).position,
      })),
      overflow: wrap ? wrap.scrollWidth - wrap.clientWidth : null,
      tableScroll: { sw: table.scrollWidth, cw: table.clientWidth, bw: table.getBoundingClientRect().width },
      tableStyle: {
        borderSpacing: getComputedStyle(table).borderSpacing,
        borderCollapse: getComputedStyle(table).borderCollapse,
        layout: getComputedStyle(table).tableLayout,
      },
      wrapStyle: { padL: getComputedStyle(wrap).paddingLeft, padR: getComputedStyle(wrap).paddingRight, ovx: getComputedStyle(wrap).overflowX },
      cellOverflow: Array.from(table.querySelectorAll('tbody tr:first-child td, thead th'))
        .map((c) => ({
          col: c.getAttribute('data-column') || (c.textContent || '').trim().slice(0, 16),
          sw: c.scrollWidth,
          cw: c.clientWidth,
          over: c.scrollWidth - c.clientWidth,
        }))
        .filter((c) => c.over > 0),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      beyond: (() => {
        if (!wrap) return [];
        const right = wrap.getBoundingClientRect().right;
        return Array.from(wrap.querySelectorAll('td, th, span, div'))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.right > right + 1 && r.width > 0)
          .slice(0, 6)
          .map(({ el, r }) => ({
            tag: el.tagName,
            cls: String(el.className).slice(0, 70),
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
            right: Math.round(r.right),
            w: Math.round(r.width),
          }));
      })(),
      ths,
    };
  });

  console.log(width, JSON.stringify(out));
}

await browser.close();
