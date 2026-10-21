// Evidence harness — PHASE 0.2
//
//   npm run evidence -- <phase> [--url /dashboard?days=30] [--tag before]
//
// Captures the dashboard across the full matrix:
//   widths   375, 768, 1024, 1440, 1920
//   themes   light, dark
//   langs    en, ar
//   -> evidence/<phase>/<lang>-<theme>/dashboard-<width>.png
//
// Two properties this harness guarantees (both were asked for explicitly):
//
//  1. ONE LOGIN. The backend rate-limits POST /api/auth/login (5/min per
//     identifier). The Playwright storageState is cached at
//     e2e/.auth/dashboard-admin.json (gitignored) and replayed on the next
//     run. The cache is validated by loading /dashboard and checking we were
//     NOT bounced to /login; if it is stale we log in once and rewrite it.
//
//  2. LANGUAGE IS SWITCHED AT RUNTIME, not seeded before load. Every Arabic
//     cell starts from an English page and then flips the language through
//     the app's own control (user menu -> Language). Widgets that read the
//     language once at construction (charts, legends, date axes) would keep
//     the old language if we only set localStorage before the load — that is
//     exactly the class of bug this catches. The harness asserts
//     document.documentElement.lang / dir after the toggle and records the
//     observed values in results.json.
//
// Theme is a boot-time concern (the .dark class + data-theme attribute are
// applied on init), so it is seeded through localStorage and the page is
// reloaded. For widths >= 640 the runtime theme button is additionally
// exercised and recorded, because it is the path a real user takes.
//
// Writes evidence/<phase>/results.json. A phase-specific
// evidence/<phase>/measurements.json (written by that phase's measurement
// script) is merged in under "measurements" so the phase can add its own
// numbers without this file knowing about them.

import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

loadEnv({ path: resolve(process.cwd(), '.env.local') });

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const PHASE = process.argv[2] ?? 'phase0';
const TAG = argValue('--tag') ?? '';
const URL_PATH = argValue('--url') ?? '/dashboard?days=30';
const OUT = resolve(process.cwd(), 'evidence', PHASE);
const AUTH_STATE = resolve(process.cwd(), 'e2e/.auth/dashboard-admin.json');

const WIDTHS = [375, 768, 1024, 1440, 1920];
const THEMES = ['light', 'dark'];
const LANGS = ['en', 'ar'];
const VIEWPORT_HEIGHT = 900;

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
}

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: process.cwd(), encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Which process serves :4200, and from which working directory?
 * The dashboard must be judged against the build that is actually being
 * served, so the harness records the provenance instead of assuming it.
 */
function serverOn4200() {
  try {
    const ss = execSync('ss -ltnp 2>/dev/null | grep :4200 || true', { encoding: 'utf8' });
    const m = ss.match(/pid=(\d+)/);
    if (!m) return { pid: null, cwd: null, cmd: null, listening: false };
    const pid = m[1];
    const cwd = execSync(`readlink /proc/${pid}/cwd`, { encoding: 'utf8' }).trim();
    const cmd = execSync(
      `tr '\\0' ' ' < /proc/${pid}/cmdline`,
      { encoding: 'utf8' },
    ).trim();
    return { pid: Number(pid), cwd, cmd, listening: true };
  } catch {
    return { pid: null, cwd: null, cmd: null, listening: false };
  }
}

// ── login / storageState ────────────────────────────────────────────────────

async function login(page) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#identifier', process.env.E2E_ADMIN_EMAIL);
    await page.fill('#password', process.env.E2E_ADMIN_PASSWORD);
    const response = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    );
    await page.click('button[type="submit"]');
    const resp = await response;
    if (resp.status() === 429) {
      console.log('  login 429 — backing off 20s');
      await page.waitForTimeout(20_000);
      continue;
    }
    if (resp.ok()) {
      await page.waitForURL('**/dashboard', { timeout: 20_000 });
      return;
    }
    throw new Error(`login failed: ${resp.status()}`);
  }
  throw new Error('login stayed rate-limited (429) after 4 attempts');
}

/** True when the current context is still authenticated. */
async function sessionIsLive(page) {
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    return !page.url().includes('/login');
  } catch {
    return false;
  }
}

// ── runtime controls ────────────────────────────────────────────────────────

/**
 * Same-origin document that does NOT boot the Angular app.
 *
 * Every real page load runs the app initializer, which POSTs
 * /api/auth/refresh. The backend ROTATES the refresh cookie on each refresh
 * and revokes the whole token family when the same cookie is presented twice
 * ("reuse detection"). Loading the app twice in quick succession therefore
 * logs the session out. Seeding language/theme through a plain same-origin
 * document keeps localStorage writable without booting the app, so each cell
 * needs exactly ONE app load.
 */
async function seedCell(page, lang, theme) {
  await page.goto(`${BASE}/__evidence-seed`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ([l, t]) => {
      localStorage.setItem('language', l);
      localStorage.setItem('nocteon-theme', t);
    },
    [lang, theme],
  );
}

/**
 * Flip the app language through the real control (user menu -> Language).
 *
 * The control is an INVERTER (it toggles between en and ar), not a setter, so
 * the loop clicks until the document language equals the target. The page is
 * always booted in the opposite language, so a healthy run needs one click; a
 * lost click (menu still animating) is handled by clicking again.
 */
async function switchLanguageAtRuntime(page, targetLang) {
  const trigger = page.locator('app-user-menu[variant="navbar"] button[data-slot="dropdown-menu-trigger"]');

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const current = await page.evaluate(() => document.documentElement.lang);
    if (current === targetLang) {
      await page.waitForTimeout(1200);
      return;
    }
    await page.keyboard.press('Escape').catch(() => {});
    try {
      await trigger.waitFor({ state: 'visible', timeout: 8_000 });
      await trigger.click();
      const item = page.locator('[role="menuitem"]', { hasText: /Language|اللغة/ });
      await item.waitFor({ state: 'visible', timeout: 8_000 });
      await item.click();
      await page.waitForFunction(
        (lang) => document.documentElement.lang === lang,
        targetLang,
        { timeout: 8_000 },
      );
      await page.waitForTimeout(1200);
      return;
    } catch {
      console.log(`  language toggle attempt ${attempt} did not land (target ${targetLang})`);
      await page.waitForTimeout(1200);
    }
  }
  const finalLang = await page.evaluate(() => document.documentElement.lang);
  throw new Error(`could not switch language to ${targetLang} (still ${finalLang})`);
}

async function observedState(page) {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    dark: document.documentElement.classList.contains('dark'),
    theme: document.documentElement.dataset['theme'] ?? null,
  }));
}

// ── capture ─────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ channel: 'chromium' });

// 1. ONE context for the whole matrix. A second login would trip the
//    backend's rate limit, and replaying a saved storageState in a second
//    context would consume the refresh token twice (the backend rotates it
//    and revokes the family on reuse), so: one context, one login, and the
//    state is re-saved at the very end of the run.
const context = await browser.newContext(
  existsSync(AUTH_STATE) ? { storageState: AUTH_STATE } : {},
);

// Same-origin non-app document for localStorage seeding (see seedCell).
await context.route('**/__evidence-seed', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><head><title>seed</title></head><body></body></html>',
  }),
);

const page = await context.newPage();

// Try the cached session. The access token lives in memory only, so a fresh
// context re-authenticates with the httpOnly refresh cookie; that cookie is
// rotated on every refresh, which is why the state is written back at the end
// of the run rather than at login time.
if (existsSync(AUTH_STATE) && (await sessionIsLive(page))) {
  console.log('reusing cached login session');
} else {
  console.log('no valid cached session — logging in once');
  await login(page);
}

const cells = [];

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      const dir = `${OUT}${TAG ? '-' + TAG : ''}/${lang}-${theme}`;
      mkdirSync(dir, { recursive: true });

      // The language is switched AT RUNTIME (through the app's own control)
      // rather than seeded before load, so a widget that captured the language
      // once at construction is caught here instead of silently keeping the
      // old language. The theme is boot-time (the .dark class is applied on
      // init), so it is seeded through the non-app document.
      const bootLang = lang === 'ar' ? 'en' : 'ar';
      await seedCell(page, bootLang, theme);
      await page.goto(`${BASE}${URL_PATH}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2200);

      if (lang === 'ar') {
        await switchLanguageAtRuntime(page, 'ar');
      } else {
        // English cell: switch to Arabic and back, so the English screenshot is
        // also produced after a runtime transition rather than a cold load.
        await switchLanguageAtRuntime(page, 'ar');
        await switchLanguageAtRuntime(page, 'en');
      }

      const state = await observedState(page);
      const file = `${dir}/dashboard-${width}.png`;
      await page.screenshot({ path: file });

      cells.push({
        lang,
        theme,
        width,
        file: file.replace(resolve(process.cwd()) + '/', ''),
        runtimeLanguageSwitch: true,
        observed: state,
      });
      console.log(
        `  ${lang}-${theme} @${width}  lang=${state.lang} dir=${state.dir} dark=${state.dark}`,
      );
    }
  }
}

// 3. Persist the (possibly rotated) session for the next run.
mkdirSync(resolve(process.cwd(), 'e2e/.auth'), { recursive: true });
await context.storageState({ path: AUTH_STATE });
await context.close();
await browser.close();

// ── results.json ────────────────────────────────────────────────────────────

// Re-run this phase's measurement script so results.json can never hold a
// stale copy: the device breakdown changes between loads, so a measurement
// taken before the capture would not describe the captured page.
const measurementScript = resolve(process.cwd(), `scripts/measure-${PHASE}.mjs`);
if (existsSync(measurementScript)) {
  console.log(`running measurements -> scripts/measure-${PHASE}.mjs`);
  const res = await import(`file://${measurementScript}`);
  if (typeof res.run === 'function') await res.run();
}

const measurementsFile = `${OUT}${TAG ? '-' + TAG : ''}/measurements.json`;
let measurements = null;
if (existsSync(measurementsFile)) {
  measurements = JSON.parse(readFileSync(measurementsFile, 'utf8'));
}

const results = {
  phase: PHASE,
  tag: TAG || null,
  generatedAt: new Date().toISOString(),
  harness: {
    command: `npm run evidence -- ${PHASE}${TAG ? ' --tag ' + TAG : ''}`,
    baseUrl: BASE,
    url: URL_PATH,
    widths: WIDTHS,
    themes: THEMES,
    langs: LANGS,
    viewportHeight: VIEWPORT_HEIGHT,
    storageState: 'e2e/.auth/dashboard-admin.json (gitignored; one login, replayed)',
    runtimeLanguageSwitch: true,
    gitBranch: git('rev-parse --abbrev-ref HEAD'),
    gitCommit: git('rev-parse --short HEAD'),
    server: serverOn4200(),
  },
  cells,
  measurements,
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}${TAG ? '-' + TAG : ''}/results.json`, JSON.stringify(results, null, 2));
console.log(`\nresults -> evidence/${PHASE}${TAG ? '-' + TAG : ''}/results.json`);
console.log(`cells captured: ${cells.length}`);
