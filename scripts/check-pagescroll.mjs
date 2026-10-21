import { chromium } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
async function login(page){for(let a=1;a<=3;a++){await page.goto(BASE+'/login');await page.fill('#identifier',process.env.E2E_ADMIN_EMAIL);await page.fill('#password',process.env.E2E_ADMIN_PASSWORD);const rp=page.waitForResponse(r=>r.url().includes('/api/auth/login')&&r.request().method()==='POST');await page.click('button[type="submit"]');const r=await rp;if(r.status()===429){await page.waitForTimeout(20000);continue;}if(r.ok()){await page.waitForURL('**/dashboard',{timeout:15000});return;}throw new Error('login '+r.status());}throw new Error('rl');}
const browser=await chromium.launch({channel:'chromium'});
for(const w of [375,390]){
const ctx=await browser.newContext({viewport:{width:w,height:812}});
const page=await ctx.newPage();
await login(page);
await page.evaluate(()=>{localStorage.setItem('language','en');localStorage.setItem('nocteon-theme','light');});
await page.goto(BASE+'/dashboard/orders',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2500);
const r=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,hasHScroll:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}));
console.log(w, r);
await ctx.close();
}
await browser.close();
