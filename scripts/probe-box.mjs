// A focused DOM probe: the box model of ONE element and its ancestors.
//   node scripts/probe-box.mjs <url> <selector>
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const url = process.argv[2];
const selector = process.argv[3];

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

const out = await page.evaluate((sel) => {
  let el = null;
  if (sel.startsWith('text:')) {
    const needle = sel.slice(5);
    el = Array.from(document.querySelectorAll('hlm-card, section, div')).find((c) =>
      (c.textContent || '').trim().replace(/\s+/g, ' ').startsWith(needle),
    );
  } else {
    el = document.querySelector(sel);
  }
  if (!el) return { error: `not found: ${sel}` };
  const chain = [];
  let node = el;
  while (node && node !== document.body) {
    const cs = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    chain.push({
      tag: node.tagName.toLowerCase(),
      slot: node.getAttribute('data-slot'),
      cls: String(node.className || '').slice(0, 150),
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      clientH: node.clientHeight,
      scrollH: node.scrollHeight,
      padding: cs.padding,
      overflowY: cs.overflowY,
      display: cs.display,
      flex: cs.flex,
      lineHeight: cs.lineHeight,
      fontSize: cs.fontSize,
      text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    });
    node = node.parentElement;
  }
  return chain;
}, selector);

console.log(JSON.stringify(out, null, 2));
await browser.close();
