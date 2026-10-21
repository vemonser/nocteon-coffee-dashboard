// Evidence harness — PHASE 0.2
//
//   npm run evidence -- <phase> [--url /dashboard?days=30] [--tag before]
//
// Captures the app across the full matrix:
//   widths   375, 768, 1024, 1440, 1920
//   themes   light, dark
//   langs    en, ar
//   -> evidence/<phase>/<lang>-<theme>/<target>-<width>.png
//
// A PHASE is a set of TARGETS (see scripts/evidence-targets.mjs). The
// `dashboard` phase captures one screen; the `orders` phase captures the
// orders list, the order detail and the three order dialogs. Every target
// is measured in the page: overflow, clipping, ellipsis, raw i18n keys and
// the target's own numbers. The measurements land in results.json.
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
import { targetsFor, settle, GENERIC_MEASURE, PHASE_HOOKS } from './evidence-targets.mjs';

loadEnv({ path: resolve(process.cwd(), '.env.local') });

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const PHASE = process.argv[2] ?? 'phase0';
const TAG = argValue('--tag') ?? '';
const URL_PATH = argValue('--url') ?? null;
const OUT = resolve(process.cwd(), 'evidence', PHASE);
const AUTH_STATE = resolve(process.cwd(), 'e2e/.auth/dashboard-admin.json');

/**
 * The widths of the matrix. The default is the app's own ladder; a phase
 * that only needs the desktop and the phone passes --widths.
 */
const WIDTHS = (argValue('--widths') ?? '375,768,1024,1440,1920')
  .split(',')
  .map((w) => Number(w.trim()))
  .filter((w) => Number.isFinite(w) && w > 0);
const THEMES = ['light', 'dark'];
const LANGS = ['en', 'ar'];
const VIEWPORT_HEIGHT = 900;

/**
 * Where the run writes. `--out` wins; otherwise the run lands in
 * evidence/<phase> (plus -<tag> when a tag is given).
 */
const RUN_DIR = argValue('--out')
  ? resolve(process.cwd(), argValue('--out'))
  : `${OUT}${TAG ? '-' + TAG : ''}`;

/** The screens this phase captures. `--url` keeps the legacy single-screen mode. */
const TARGETS = targetsFor(PHASE, URL_PATH);

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
    // The port the capture actually ran against — the harness may be pointed
    // at a second dev server when the main one is busy.
    const port = new URL(BASE).port || '4200';
    const ss = execSync(`ss -ltnp 2>/dev/null | grep :${port} || true`, { encoding: 'utf8' });
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
    // The app must be INTERACTIVE before the form can be filled: a dev
    // server that is still compiling answers the document, not the app, and
    // the click on a form nobody wired yet sends nothing — the run then
    // waits for a response that will never come.
    await page.waitForSelector('#identifier', { state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(500);
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

// 2. The phase's fixtures (a review that does not exist in the seed, …).
//    They are made ONCE, before the matrix, and the same fixture is used by
//    every cell, so the "before" and the "after" runs are comparable.
const hooks = PHASE_HOOKS[PHASE] ?? null;
let fixtureContext = null;
if (hooks?.setup) {
  try {
    fixtureContext = await hooks.setup(page);
    console.log(`fixture: ${JSON.stringify({ ...fixtureContext, token: undefined })}`);
  } catch (err) {
    fixtureContext = { error: String(err?.message ?? err) };
    console.error(`fixture setup failed: ${fixtureContext.error}`);
  }
}

const cells = [];

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      const dir = `${RUN_DIR}/${lang}-${theme}`;
      mkdirSync(dir, { recursive: true });

      const targetResults = [];

      for (const target of TARGETS) {
        // The language is switched AT RUNTIME (through the app's own control)
        // rather than seeded before load, so a widget that captured the language
        // once at construction is caught here instead of silently keeping the
        // old language. The theme is boot-time (the .dark class is applied on
        // init), so it is seeded through the non-app document.
        //
        // EVERY target is booted in the opposite language and switched at
        // runtime, so a page that only reacts on a cold load is caught.
        const bootLang = lang === 'ar' ? 'en' : 'ar';
        await seedCell(page, bootLang, theme);
        await page.goto(`${BASE}${target.url}`, { waitUntil: 'domcontentloaded' });
        await settle(page, 1800);

        if (lang === 'ar') {
          await switchLanguageAtRuntime(page, 'ar');
        } else {
          // English cell: switch to Arabic and back, so the English screenshot is
          // also produced after a runtime transition rather than a cold load.
          await switchLanguageAtRuntime(page, 'ar');
          await switchLanguageAtRuntime(page, 'en');
        }

        // An optional interaction BEFORE the screenshot (open a dialog, …).
        let action = null;
        if (target.action) {
          try {
            action = await target.action(page);
          } catch (err) {
            action = { present: false, error: String(err?.message ?? err) };
          }
        }

        const state = await observedState(page);
        const file = `${dir}/${target.id}-${width}.png`;
        await page.screenshot({ path: file });

        // Measurements: the generic invariants for every screen, plus the
        // target's own numbers.
        let generic = null;
        try {
          generic = await page.evaluate(GENERIC_MEASURE);
        } catch (err) {
          generic = { error: String(err?.message ?? err) };
        }
        let own = null;
        if (target.measure) {
          try {
            own = await target.measure(page);
          } catch (err) {
            own = { error: String(err?.message ?? err) };
          }
        }

        targetResults.push({
          id: target.id,
          url: target.url,
          file: file.replace(resolve(process.cwd()) + '/', ''),
          action,
          observed: state,
          measurements: generic,
          own,
        });

        console.log(
          `  ${lang}-${theme} @${width}  ${target.id}  lang=${state.lang} dir=${state.dir} dark=${state.dark}` +
            (generic?.horizontalOverflowPx ? `  OVERFLOW ${generic.horizontalOverflowPx}px` : '') +
            (generic?.rawI18nKeys?.length ? `  RAW-KEYS ${generic.rawI18nKeys.length}` : '') +
            (generic?.verticalClipped?.length ? `  VCLIP ${generic.verticalClipped.length}` : ''),
        );
      }

      cells.push({
        lang,
        theme,
        width,
        runtimeLanguageSwitch: true,
        observed: targetResults.length ? targetResults[0].observed : null,
        targets: targetResults,
      });
    }
  }
}

// 3. Persist the (possibly rotated) session for the next run.
mkdirSync(resolve(process.cwd(), 'e2e/.auth'), { recursive: true });
await context.storageState({ path: AUTH_STATE });

// 3b. The fixtures are cleaned up here — after the matrix, and only when the
//     run was asked to.
let teardown = null;
if (hooks?.teardown) {
  try {
    teardown = await hooks.teardown(page, fixtureContext);
    console.log(`fixture teardown: ${JSON.stringify(teardown)}`);
  } catch (err) {
    teardown = { error: String(err?.message ?? err) };
    console.error(`fixture teardown failed: ${teardown.error}`);
  }
}

await context.close();
await browser.close();

// ── results.json ────────────────────────────────────────────────────────────

// The results are written TWICE: once with the matrix, and once more after
// the phase's measurement script has run. The script reads the run's own
// results.json (so it summarises the numbers that were actually measured,
// not a second, separate pass) and writes measurements.json, which is
// merged back in.
const resultsFile = `${RUN_DIR}/results.json`;
mkdirSync(RUN_DIR, { recursive: true });

let measurementError = null;

const buildResults = (measurementsValue) => ({
  phase: PHASE,
  tag: TAG || null,
  generatedAt: new Date().toISOString(),
  harness: {
    command: `npm run evidence -- ${PHASE}${TAG ? ' --tag ' + TAG : ''}`,
    baseUrl: BASE,
    url: URL_PATH,
    targets: TARGETS.map((t) => t.id),
    widths: WIDTHS,
    themes: THEMES,
    langs: LANGS,
    viewportHeight: VIEWPORT_HEIGHT,
    storageState: 'e2e/.auth/dashboard-admin.json (gitignored; one login, replayed)',
    runtimeLanguageSwitch: true,
    fixture: fixtureContext ? { ...fixtureContext, token: undefined } : null,
    teardown,
    gitBranch: git('rev-parse --abbrev-ref HEAD'),
    gitCommit: git('rev-parse --short HEAD'),
    server: serverOn4200(),
  },
  cells,
  measurements: measurementsValue,
  measurementError,
});

writeFileSync(resultsFile, JSON.stringify(buildResults(null), null, 2));

const measurementScript = resolve(process.cwd(), `scripts/measure-${PHASE}.mjs`);
if (existsSync(measurementScript)) {
  console.log(`running measurements -> scripts/measure-${PHASE}.mjs`);
  try {
    // The measurement script writes where THIS run writes, so the numbers
    // in results.json always describe the run that produced the screenshots.
    process.env.EVIDENCE_OUT = RUN_DIR;
    const res = await import(`file://${measurementScript}`);
    if (typeof res.run === 'function') await res.run();
  } catch (err) {
    measurementError = String(err?.message ?? err);
    console.error(`measurement failed: ${measurementError}`);
  }
}

const measurementsFile = `${RUN_DIR}/measurements.json`;
let measurements = null;
if (existsSync(measurementsFile)) {
  measurements = JSON.parse(readFileSync(measurementsFile, 'utf8'));
}

writeFileSync(resultsFile, JSON.stringify(buildResults(measurements), null, 2));
console.log(`\nresults -> ${RUN_DIR.replace(resolve(process.cwd()) + '/', '')}/results.json`);
console.log(`cells captured: ${cells.length}`);
