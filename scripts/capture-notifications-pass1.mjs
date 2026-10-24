import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = 'evidence/notifications/pass1';
await mkdir(OUT, { recursive: true });

const shots = [];
const checks = {};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

async function shot(name, state, variant) {
  const file = join(OUT, `${state}-${variant}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push({ state, variant, file, url: page.url() });
  console.log('shot', file);
}

async function isDark() {
  return page.evaluate(() => document.documentElement.classList.contains('dark'));
}
async function setDark(want) {
  if ((await isDark()) !== want) {
    await page.locator('.theme-btn').click();
    await page.waitForTimeout(450);
  }
  if ((await isDark()) !== want) throw new Error('theme switch failed');
}
async function lang() {
  return page.evaluate(() => document.documentElement.lang);
}
async function setLang(want) {
  if ((await lang()) === want) return;
  await page.locator('app-user-menu[variant="navbar"] button').first().click();
  await page.waitForTimeout(250);
  await page.getByRole('menuitem').filter({ hasText: /Language|اللغة/ }).first().click();
  await page.waitForTimeout(1400);
  if ((await lang()) !== want) throw new Error(`language switch failed: ${await lang()}`);
}

const bell = () => page.locator('[data-testid="notifications-bell"]').first();
const popover = () => page.locator('[data-testid="notifications-popover"]');

async function openBell() {
  await bell().click();
  await page.waitForSelector('[data-testid="notifications-popover"]', { timeout: 5000 });
}
async function closePopover() {
  if (await popover().count()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}

// ── login ─────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#identifier', 'admin@aurum.local');
await page.fill('#password', 'Admin@123');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { timeout: 20000 });
// Boot the app again so the root notification service sees the dev mock flag.
// (The login page has no dashboard shell, so the service is first constructed here.)
await page.goto(`${BASE}/dashboard?mockNotifications=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

await setDark(false);
await setLang('en');

// ── A. light-en ───────────────────────────────────────────────────────────
await openBell();
await page.waitForTimeout(250);
await shot('popover', 'skeleton', 'light-en');
await page.waitForTimeout(1500);

// badge == unread count
const aria = await bell().getAttribute('aria-label');
const badgeText = await bell().locator('span').first().innerText().catch(() => '');
const unreadFromAria = Number((aria ?? '').match(/(\d+)/)?.[1] ?? NaN);
checks.a_badge_matches_unread = {
  bellAria: aria,
  badgeText,
  unreadFromAria,
  pass: String(unreadFromAria) === badgeText.trim(),
};

// scroll / sticky chrome geometry
checks.d_scroll = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const list = q('[data-testid="notifications-list"]');
  const header = q('[data-testid="notifications-header"]');
  const footer = q('[data-testid="notifications-footer"]');
  const pop = q('[data-testid="notifications-popover"]');
  if (!list || !header || !footer || !pop) return { pass: false, reason: 'missing nodes' };
  const pr = pop.getBoundingClientRect();
  const hr = header.getBoundingClientRect();
  const fr = footer.getBoundingClientRect();
  return {
    scrollHeight: list.scrollHeight,
    clientHeight: list.clientHeight,
    scrollable: list.scrollHeight > list.clientHeight,
    popoverHeight: Math.round(pr.height),
    headerVisible: hr.top >= pr.top - 1 && hr.bottom <= pr.bottom + 1,
    footerVisible: fr.top >= pr.top - 1 && fr.bottom <= pr.bottom + 1,
    pass: list.scrollHeight > list.clientHeight && hr.top >= pr.top - 1 && fr.bottom <= pr.bottom + 1,
  };
});

await shot('popover', 'popover', 'light-en');

// keyboard: ArrowDown -> next item, Esc -> bell
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
const firstFocus = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 60) ?? '');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
const secondFocus = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 60) ?? '');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const focusAfterEsc = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
checks.b_keyboard = {
  firstFocus,
  secondFocus,
  focusAfterEsc,
  moved: firstFocus.length > 0 && firstFocus !== secondFocus,
  escReturnsToBell: (focusAfterEsc ?? '').startsWith('Notifications'),
  pass: firstFocus.length > 0 && firstFocus !== secondFocus && (focusAfterEsc ?? '').startsWith('Notifications'),
};

// ── B. dark-en ────────────────────────────────────────────────────────────
await setDark(true);
await openBell();
await page.waitForTimeout(250);
await shot('popover', 'skeleton', 'dark-en');
await page.waitForTimeout(1500);
await shot('popover', 'popover', 'dark-en');
await closePopover();

// ── C. light-ar ───────────────────────────────────────────────────────────
await setDark(false);
await setLang('ar');
await openBell();
await page.waitForTimeout(250);
await shot('popover', 'skeleton', 'light-ar');
await page.waitForTimeout(1500);
await shot('popover', 'popover', 'light-ar');

// ── D. full page (real in-app navigation via the footer button) ───────────
await page.getByTestId('notifications-footer').getByRole('button').click();
await page.waitForURL('**/dashboard/notifications', { timeout: 10000 });
await page.waitForTimeout(1700);
await shot('page', 'page', 'light-ar');

await setDark(true);
await setLang('en');
await page.waitForTimeout(500);
await shot('page', 'page', 'dark-en');

await setDark(false);
await page.waitForTimeout(400);
await shot('page', 'page', 'light-en');

// ── E. empty states + mark-all behaviour ──────────────────────────────────
await openBell();
await page.waitForTimeout(1500);
const beforeUnread = await page.evaluate(() => {
  const a = document.querySelector('[data-testid="notifications-bell"]')?.getAttribute('aria-label') ?? '';
  return Number(a.match(/(\d+)/)?.[1] ?? NaN);
});
await page.getByTestId('notifications-mark-all').click();
await page.waitForTimeout(400);
const afterBadge = await page.evaluate(() => {
  const b = document.querySelector('[data-testid="notifications-bell"]');
  const span = b?.querySelector('span');
  return span ? span.textContent.trim() : null;
});
const markAllDisabled = await page.getByTestId('notifications-mark-all').isDisabled();
checks.c_mark_all = {
  beforeUnread,
  afterBadge,
  markAllDisabled,
  pass: beforeUnread > 0 && afterBadge === null && markAllDisabled,
};

// Unread tab -> empty
await page.getByTestId('notifications-tab-unread').click();
await page.waitForTimeout(1600);
await shot('empty', 'empty', 'light-en');
await closePopover();

await setDark(true);
await openBell();
await page.waitForTimeout(1500);
await page.getByTestId('notifications-tab-unread').click();
await page.waitForTimeout(1600);
await shot('empty', 'empty', 'dark-en');
await closePopover();

await setDark(false);
await setLang('ar');
await openBell();
await page.waitForTimeout(1500);
await page.getByTestId('notifications-tab-unread').click();
await page.waitForTimeout(1600);
await shot('empty', 'empty', 'light-ar');

await closePopover();

const results = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE,
  viewport: '1440x900',
  mock: '?mockNotifications=1 (dev build only)',
  checks,
  screenshots: shots,
};
await writeFile(join(OUT, 'results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(checks, null, 2));
await browser.close();
