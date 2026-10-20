import { chromium } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
async function login(page){for(let a=1;a<=3;a++){await page.goto(BASE+'/login');await page.fill('#identifier',process.env.E2E_ADMIN_EMAIL);await page.fill('#password',process.env.E2E_ADMIN_PASSWORD);const rp=page.waitForResponse(r=>r.url().includes('/api/auth/login')&&r.request().method()==='POST');await page.click('button[type="submit"]');const r=await rp;if(r.status()===429){await page.waitForTimeout(20000);continue;}if(r.ok()){await page.waitForURL('**/dashboard',{timeout:15000});return;}throw new Error('login '+r.status());}throw new Error('rl');}
const browser=await chromium.launch({channel:'chromium'});
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
const page=await ctx.newPage();
page.on('response', r=>{ if(r.status()===401) console.log('401:', r.url()); });
await login(page);
await page.evaluate(()=>{localStorage.setItem('language','en');localStorage.setItem('nocteon-theme','light');});
await page.goto(BASE+'/dashboard/orders',{waitUntil:'networkidle'});
await page.waitForTimeout(2000);
await browser.close();
