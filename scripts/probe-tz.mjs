import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();
await page.goto('http://localhost:4200/login');
const r = await page.evaluate(() => ({
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  offset: new Date().getTimezoneOffset(),
  now: new Date().toString(),
}));
console.log(JSON.stringify(r));
await browser.close();
