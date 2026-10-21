// Overflow / clipping measurement for the dashboard at the narrow widths.
//   node scripts/measure-phase1-overflow.mjs
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const OUT = resolve(process.cwd(), 'evidence/phase1');
const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext();
await ctx.route('**/__seed', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' }));
const page = await ctx.newPage();
await page.goto('http://localhost:4200/login');
await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');

const results = [];
for (const lang of ['en', 'ar']) {
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://localhost:4200/__seed');
    await page.evaluate((l) => localStorage.setItem('language', l), lang);
    await page.goto('http://localhost:4200/dashboard?days=30');
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const clipped = [];
      for (const el of document.querySelectorAll('h1,h2,h3,p,span,a,button')) {
        if (el.children.length) continue;
        const txt = (el.textContent || '').trim();
        if (!txt) continue;
        if (el.scrollWidth > el.clientWidth + 1) {
          // `truncate` is an intentional ellipsis; `sr-only` is screen-reader
          // text that is not rendered at all. Neither is a visual defect.
          const cls = typeof el.className === 'string' ? el.className : '';
          clipped.push({
            text: txt.slice(0, 40),
            intentional: cls.includes('truncate') || cls.includes('sr-only'),
            reason: cls.includes('sr-only') ? 'screen-reader only (not rendered)' : cls.includes('truncate') ? 'ellipsis by design' : 'CLIPPED',
          });
        }
      }
      return {
        horizontalOverflowPx: de.scrollWidth - de.clientWidth,
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        clipped,
      };
    });
    r.unintentionallyClipped = r.clipped.filter((c) => !c.intentional);
    results.push({ lang, width, ...r, pass: r.horizontalOverflowPx <= 0 && r.unintentionallyClipped.length === 0 });
    console.log(
      `${lang} @${width}: overflow=${r.horizontalOverflowPx}px, clipped=${r.clipped.length}, unintended=${r.unintentionallyClipped.length}`,
    );
  }
}
await browser.close();
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/overflow.json`, JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 2));
console.log('-> evidence/phase1/overflow.json');
