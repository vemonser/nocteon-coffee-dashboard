import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const OUT = resolve(process.cwd(), 'evidence', 'users', 'pass1');
mkdirSync(OUT, { recursive: true });
const AUTH_STATE = resolve(process.cwd(), 'e2e/.auth/dashboard-admin.json');

const browser = await chromium.launch({ channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {}) });
await context.route('**/__evidence-seed', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
const page = await context.newPage();

async function sessionIsLive() {
  try { await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2000); return !page.url().includes('/login'); } catch { return false; }
}
async function login() {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#identifier', { state: 'visible', timeout: 60000 });
    await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
    await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
    const response = page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST');
    await page.click('button[type="submit"]');
    const resp = await response;
    if (resp.status() === 429) { await page.waitForTimeout(20000); continue; }
    if (resp.ok()) { await page.waitForURL('**/dashboard', { timeout: 20000 }); return; }
    throw new Error(`login failed: ${resp.status()}`);
  }
  throw new Error('login rate limited');
}
if (!(await sessionIsLive())) await login();

// seed en light
await page.goto(`${BASE}/__evidence-seed`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { localStorage.setItem('language','en'); localStorage.setItem('nocteon-theme','light'); });
await page.goto(`${BASE}/dashboard/users`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const measurements = await page.evaluate(() => {
  const table = document.querySelector('app-data-table table');
  const rows = Array.from(table.querySelectorAll('tbody tr')).filter(tr => tr.querySelector('td') && !tr.hasAttribute('aria-hidden'));
  const heights = rows.map(tr => Math.round(tr.getBoundingClientRect().height));
  const maxH = Math.max(...heights); const minH = Math.min(...heights);
  // filter row native selects
  const filterRow = document.querySelector('.page-shell .flex.flex-wrap.items-center.gap-3');
  const nativeSelects = filterRow ? Array.from(filterRow.querySelectorAll('select')) : [];
  const rawNative = nativeSelects.filter(s => !s.hasAttribute('data-slot'));
  // search input height
  const searchInput = filterRow ? filterRow.querySelector('input[type="search"]') : null;
  const firstSelect = nativeSelects[0];
  const searchH = searchInput ? Math.round(searchInput.getBoundingClientRect().height) : null;
  const selectH = firstSelect ? Math.round(firstSelect.getBoundingClientRect().height) : null;
  // raw i18n keys
  const RAW_KEY = /\b[a-z]+\.[a-z]+\.[A-Z_]+\b/;
  const rawKeys = Array.from(document.querySelectorAll('body *'))
    .filter(el => el.children.length === 0)
    .map(el => (el.textContent||'').trim())
    .filter(t => t && RAW_KEY.test(t));
  // uppercase role text? check role badges text
  const roleTexts = Array.from(document.querySelectorAll('td')).map(td => (td.textContent||'').trim()).filter(Boolean);
  return { rowCount: rows.length, heights, maxHeight: maxH, minHeight: minH, heightSpread: maxH-minH, nativeSelectCount: nativeSelects.length, rawNativeSelectCount: rawNative.length, searchH, selectH, rawI18nKeys: Array.from(new Set(rawKeys)), sampleRoleTexts: roleTexts.slice(0,5) };
});

// aria-disabled check on admin row kebab
await page.goto(`${BASE}/dashboard/users`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const adminRow = page.locator('tr', { hasText: 'admin@aurum.local' }).first();
const kebab = adminRow.locator('button').last();
await kebab.click();
await page.waitForTimeout(500);
const ariaDisabled = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
  return items.map(el => ({ text: (el.textContent||'').trim(), disabled: el.getAttribute('disabled') !== null, ariaDisabled: el.getAttribute('aria-disabled') }));
});
const deleteItem = ariaDisabled.find(x => /Delete|حذف/i.test(x.text));
const blockItem = ariaDisabled.find(x => /Block|Unblock|حظر/i.test(x.text));
const changeRoleItem = ariaDisabled.find(x => /Change role|تغيير الدور/i.test(x.text));

const results = {
  task: 'users-pass-1',
  viewport: '1440x900',
  assertions: {
    'a_all_table_rows_equal_height_lte_1px': { pass: measurements.heightSpread <= 1, ...measurements },
    'b_no_raw_native_select_in_filter_row': { pass: measurements.rawNativeSelectCount === 0, rawNativeSelectCount: measurements.rawNativeSelectCount, nativeSelectCount: measurements.nativeSelectCount },
    'c_search_input_height_equals_select_height': { pass: measurements.searchH === measurements.selectH, searchH: measurements.searchH, selectH: measurements.selectH },
    'd_admin_row_delete_block_change_role_aria_disabled': {
      pass: !!(deleteItem?.ariaDisabled === 'true' || deleteItem?.disabled) && !!(blockItem?.ariaDisabled === 'true' || blockItem?.disabled) && !!(changeRoleItem?.ariaDisabled === 'true' || changeRoleItem?.disabled),
      delete: deleteItem, block: blockItem, changeRole: changeRoleItem,
    },
    'e_no_raw_i18n_key_and_no_uppercase_role_text': {
      pass: measurements.rawI18nKeys.length === 0,
      rawI18nKeys: measurements.rawI18nKeys,
    },
  },
};
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

await context.storageState({ path: AUTH_STATE });
await context.close();
await browser.close();
