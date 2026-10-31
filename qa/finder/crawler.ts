import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { detectorInitScript } from './bundle.ts';
import { captureCrops } from './vision.ts';
import { curatedRoutes, fastRoutes, paramRoutes, routeGaps, type FinderRoute } from './routes.ts';
import type { CrawlOptions, CrawlResult, Finding, StateRecord } from './types.ts';
import type { DetectorContext, Issue } from './detectors/types.ts';

const require = createRequire(resolve(process.cwd(), 'package.json'));
require('dotenv').config({ path: '.env.local', quiet: true });

interface Env {
  name: string;
  theme: 'light' | 'dark';
  lang: 'en' | 'ar';
  viewport: { w: number; h: number };
}

const ENVS: Env[] = [
  { name: 'light/en/1440', theme: 'light', lang: 'en', viewport: { w: 1440, h: 900 } },
  { name: 'dark/en/1440', theme: 'dark', lang: 'en', viewport: { w: 1440, h: 900 } },
  { name: 'light/ar/1440', theme: 'light', lang: 'ar', viewport: { w: 1440, h: 900 } },
  { name: 'light/en/390', theme: 'light', lang: 'en', viewport: { w: 390, h: 844 } },
];

/** Clicks the crawler will never make: they mutate or send. */
export const DENY_CLICK =
  /delete|remove|permanently|block|send|publish|approve|reject|refund|logout|log out|empty trash|create product|trash|archive|restore|purge|sign out/i;

/** Controls that open something, so their open state can be inspected. */
const OPENS =
  /menu|actions|more|options|filter|sort|columns|export|view|settings|edit|add|new|open|select|choose|pick|share|details/i;

const MOCKED_ENVELOPE = {
  success: true,
  message: 'finder: empty',
  code: null,
  errors: null,
  summary: null,
  timestamp: new Date(0).toISOString(),
};

/** The QA prefixes, read once from the same file the purge script uses. */
const TEST_PREFIXES: string[] = (() => {
  try {
    return JSON.parse(
      require('node:fs').readFileSync(resolve(process.cwd(), 'qa', 'test-prefixes.json'), 'utf8'),
    ).prefixes;
  } catch {
    return [];
  }
})();

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

async function login(page: Page, baseUrl: string): Promise<void> {
  const email = process.env['FINDER_EMAIL'] ?? process.env['E2E_ADMIN_EMAIL'];
  const password = process.env['FINDER_PASSWORD'] ?? process.env['E2E_ADMIN_PASSWORD'];
  if (!email || !password) {
    throw new Error('finder: set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (or FINDER_EMAIL / FINDER_PASSWORD)');
  }
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('#identifier').fill(email);
    await page.locator('#password').fill(password);
    const response = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.locator('button[type="submit"]').click();
    const res = await response.catch(() => null);
    lastStatus = res?.status() ?? 0;
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }).catch(() => {});
    if (!page.url().includes('/login')) return;
    await page.waitForTimeout(20_000);
  }
  throw new Error(`finder: login failed (last status ${lastStatus})`);
}

async function applyEnv(page: Page, env: Env): Promise<void> {
  await page.setViewportSize({ width: env.viewport.w, height: env.viewport.h });
  await page.evaluate(
    ([theme, lang]) => {
      localStorage.setItem('nocteon-theme', theme);
      localStorage.setItem('language', lang);
    },
    [env.theme, env.lang],
  );
}

async function waitForApp(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.locator('main, app-dashboard').first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // The KPI row swaps from a skeleton to the numbers; measuring the skeleton
  // is measuring a placeholder, and a value defect hides behind it.
  if (await page.locator('[data-testid="kpi-primary-skeleton"]').count().catch(() => 0)) {
    await page.locator('[data-testid="kpi-primary-row"]').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  }
}

function attachLogs(page: Page): {
  console: StateRecord['console'];
  network: StateRecord['network'];
  clear: () => void;
  stop: () => void;
} {
  const state = { console: [] as StateRecord['console'], network: [] as StateRecord['network'] };
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    if (/Failed to load resource.*(401|403|429)/.test(text)) return;
    state.console.push({ type, text: text.slice(0, 400) });
  };
  const onResponse = (response: { status: () => number; url: () => string }) => {
    const status = response.status();
    if (status >= 400) state.network.push({ status, url: response.url().slice(0, 200) });
  };
  page.on('console', onConsole);
  page.on('response', onResponse);
  return {
    get console() {
      return state.console;
    },
    get network() {
      return state.network;
    },
    clear() {
      state.console.length = 0;
      state.network.length = 0;
    },
    stop() {
      page.off('console', onConsole);
      page.off('response', onResponse);
    },
  } as never;
}

export async function crawl(options: CrawlOptions): Promise<CrawlResult> {
  const startedAt = new Date().toISOString();
  mkdirSync(options.outDir, { recursive: true });
  const screensDir = resolve(options.outDir, 'screens');
  const states: StateRecord[] = [];
  const findings: Finding[] = [];
  const fingerprints: CrawlResult['fingerprints'] = [];
  const crops: CrawlResult['crops'] = [];
  let apiToken: string | null = null;
  let tokens: CrawlResult['tokens'] = { colors: [], fontSizes: [] };

  const curated = curatedRoutes();
  const params = paramRoutes();
  const gaps = routeGaps(curated);
  let allRoutes: FinderRoute[] = options.fast ? fastRoutes(curated) : [...curated];
  if (options.routes?.length) {
    const wanted = new Set(options.routes.map((r) => r.replace(/\/$/, '')));
    allRoutes = allRoutes.filter((r) => wanted.has(r.path) || wanted.has(r.page));
  }

  const browser: Browser = await chromium.launch({
    channel: 'chromium',
    headless: !options.headed,
  });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript({ content: detectorInitScript() });
  // A control that disappears between two states must fail fast, not block
  // the crawl for the 30s default.
  context.setDefaultTimeout(2_500);
  const page = await context.newPage();
  page.on('request', (request) => {
    const header = request.headers()['authorization'];
    if (header?.startsWith('Bearer ')) apiToken = header.slice(7);
  });
  const logs = attachLogs(page);

  try {
    await login(page, options.baseUrl);

    // The sidebar's live links (the shell is permission-gated, so the DOM is
    // the only truthful list for this user).
    await page.goto(`${options.baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    const sidebar = await page.evaluate(() =>
      Array.from(document.querySelectorAll('aside a[href^="/dashboard"], [data-slot="sidebar"] a[href^="/dashboard"], [data-sidebar="menu-button"] a[href^="/dashboard"]'))
        .map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? '')
        .filter((href) => href && !href.includes('#'))
        .map((href) => href.split('?')[0]),
    );
    const seenPaths = new Set(allRoutes.map((r) => r.path));
    for (const href of sidebar) {
      if (seenPaths.has(href)) continue;
      seenPaths.add(href);
      allRoutes.push({ page: `sidebar:${slug(href)}`, path: href });
    }

    // Resolve parameterised routes from their list page's first row.
    for (const route of params) {
      if (options.fast && !['product-edit', 'order-detail'].includes(route.page)) continue;
      if (options.maxRoutes && allRoutes.length >= options.maxRoutes) break;
      const listPath = route.path.replace(/\/:[^/]+.*$/, '');
      await page.goto(`${options.baseUrl}${listPath}`, { waitUntil: 'domcontentloaded' });
      await waitForApp(page);
      const href = await page.evaluate(
        (source) => {
          const re = new RegExp(`^${source}$`);
          return Array.from(document.querySelectorAll('a[href^="/dashboard"]'))
            .map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? '')
            .map((h) => h.split('?')[0])
            .find((h) => re.test(h));
        },
        route.path.replace(/:[^/]+/g, '[^/]+'),
      );
      if (!href) continue;
      allRoutes.push({ page: route.page, path: href, param: true });
    }

    // The CLI allow-list applies to the parameterised routes too (they are
    // resolved after the first filter).
    if (options.routes?.length) {
      const wanted = new Set(options.routes.map((r) => r.replace(/\/$/, '')));
      allRoutes = allRoutes.filter((r) => wanted.has(r.path) || wanted.has(r.page));
    }

    const envs = options.fast ? ENVS.slice(0, 1) : ENVS;

    for (const [envIndex, env] of envs.entries()) {
      await applyEnv(page, env);

      for (const route of allRoutes) {
        if (options.maxRoutes && states.length > options.maxRoutes * 8) break;
        const pageUrl = `${options.baseUrl}${route.path}`;
        const before = Date.now();
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await waitForApp(page);
        if (!page.url().includes(route.path)) {
          // A permission redirect (or a 404): recorded, never fatal.
          continue;
        }

        const maxInteraction = options.fast ? 4 : 8;

        const visit = async (stateName: string, ctxExtra: Partial<DetectorContext> = {}) => {
          logs.clear();
          // A pointer left on a control applies its :hover style, which is a
          // transient state, not the page's design. Move it away before
          // measuring and screenshotting.
          await page.mouse.move(2, 2).catch(() => {});
          await page.waitForTimeout(120);
          const stateSlug = slug(stateName) || 'state';
          const shotDir = resolve(screensDir, slug(route.page), slug(env.name));
          mkdirSync(shotDir, { recursive: true });
          const screenshot = resolve(shotDir, `${stateSlug}.png`);
          await page.screenshot({ path: screenshot, animations: 'disabled', fullPage: false });
          const native = await page
            .evaluate(() => {
              const dialogs = (window as unknown as { __finderNativeDialogs?: Array<{ kind: string; message: string }> })
                .__finderNativeDialogs ?? [];
              (window as unknown as { __finderNativeDialogs?: unknown[] }).__finderNativeDialogs = [];
              return dialogs;
            })
            .catch(() => []);
          const ctx: DetectorContext = {
            route: route.path,
            state: stateName,
            lang: env.lang,
            theme: env.theme,
            viewport: env.viewport,
            testPrefixes: TEST_PREFIXES,
            nativeDialogs: native,
            mocked: null,
            ...ctxExtra,
          };
          const issues: Issue[] = await page.evaluate(
            (c) => (window as unknown as { __finder: { run: (ctx: unknown) => Issue[] } }).__finder.run(c),
            ctx,
          );
          const aria = await page.ariaSnapshot().catch(() => '');
          const stateFindings: Finding[] = issues.map((issue) => ({
            ...issue,
            page: route.page,
            route: route.path,
            state: stateName,
            env: env.name,
            screenshot,
          }));
          // Runtime errors are findings too: a page that throws is broken.
          for (const entry of logs.console) {
            if (entry.type !== 'error') continue;
            if (/websocket|SSE|EventSource|ResizeObserver loop/i.test(entry.text)) continue;
            stateFindings.push({
              detector: 'runtime',
              id: 'runtime.console-error',
              severity: 'medium',
              selector: 'console',
              message: 'The page logs a console error.',
              evidence: entry.text.slice(0, 200),
              page: route.page,
              route: route.path,
              state: stateName,
              env: env.name,
              screenshot,
            });
          }
          for (const entry of logs.network) {
            if (entry.status < 500) continue;
            stateFindings.push({
              detector: 'runtime',
              id: 'runtime.network-error',
              severity: 'medium',
              selector: 'network',
              message: 'A request failed with a server error.',
              evidence: `${entry.status} ${entry.url}`,
              page: route.page,
              route: route.path,
              state: stateName,
              env: env.name,
              screenshot,
            });
          }
          const record: StateRecord = {
            page: route.page,
            route: route.path,
            state: stateName,
            env: env.name,
            url: page.url(),
            title: await page.title(),
            screenshot,
            aria: aria.slice(0, 40_000),
            console: logs.console,
            network: logs.network,
            issues: stateFindings,
          };
          states.push(record);
          findings.push(...stateFindings);
          return record;
        };

        await visit('default');

        // A modal opened by a control can block every later click for the
        // full timeout. Close what can be closed; reload when it cannot.
        const resetPage = async () => {
          const overlay = page.locator('[role="dialog"]:visible,[role="alertdialog"]:visible');
          if (!(await overlay.count().catch(() => 0))) return;
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(250);
          if (!(await overlay.count().catch(() => 0))) return;
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await waitForApp(page);
        };

        if (!options.fast && envIndex === 0) {
          crops.push(...(await captureCrops(page, options.outDir, route.path, 'default', route.page)));
        }

        // Fingerprints and the token palette: once per route, in the default
        // state of the first environment.
        if (envIndex === 0) {
          const fps = await page.evaluate(
            (c) =>
              (
                window as unknown as {
                  __finder: { fingerprints: (ctx: unknown) => Array<Record<string, unknown>> };
                }
              ).__finder.fingerprints(c),
            {
              route: route.path,
              state: 'default',
              lang: env.lang,
              theme: env.theme,
              viewport: env.viewport,
              testPrefixes: [],
            },
          );
          for (const fp of fps) {
            fingerprints.push({
              page: route.page,
              route: route.path,
              role: String(fp['role']),
              key: String(fp['key']),
              values: fp['values'] as Record<string, unknown>,
              selector: String(fp['selector']),
              text: String(fp['text']),
            });
          }
          tokens = await page.evaluate(() => {
            const win = window as unknown as {
              __finderTokens?: () => { colors: string[]; fontSizes: number[] };
            };
            return win.__finderTokens?.() ?? { colors: [], fontSizes: [] };
          });
        }

        // Interaction states only in the first environment: the shape of a
        // tab, menu or dialog does not change with the theme or locale.
        if (envIndex !== 0) continue;
        if (options.noInteractions) continue;

        // 1. Each tab.
        const tabLocator = page.locator('main [role="tab"]:visible');
        const tabCount = Math.min(await tabLocator.count().catch(() => 0), maxInteraction);
        for (let index = 0; index < tabCount; index += 1) {
          const tab = tabLocator.nth(index);
          const name = ((await tab.textContent({ timeout: 2000 }).catch(() => '')) ?? '')
            .trim()
            .replace(/\s+/g, ' ');
          if (!name || DENY_CLICK.test(name)) continue;
          if (!(await tab.isEnabled().catch(() => false))) continue;
          await tab.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(400);
          await visit(`tab:${name}`);
          await resetPage();
        }

        // 2. Accordions and disclosures.
        const disclosureLocator = page.locator('main button[aria-expanded]:visible');
        const disclosureCount = Math.min(await disclosureLocator.count().catch(() => 0), maxInteraction);
        for (let index = 0; index < disclosureCount; index += 1) {
          const button = disclosureLocator.nth(index);
          const name = ((await button.textContent({ timeout: 2000 }).catch(() => '')) ?? '')
            .trim()
            .replace(/\s+/g, ' ');
          if (!name || DENY_CLICK.test(name)) continue;
          const expanded = await button.getAttribute('aria-expanded', { timeout: 2000 }).catch(() => null);
          if (expanded === 'true') continue;
          await button.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(400);
          await visit(`disclosure:${name}`);
          await resetPage();
          const again = page.locator('main button[aria-expanded="true"]:visible').first();
          if (await again.count().catch(() => 0)) await again.click({ timeout: 2500 }).catch(() => {});
        }

        // 3. Overlays: menus, popovers, dialogs.
        // Only controls that DECLARE an overlay. Scanning every button on a
        // page with 40 buttons costs a locator round-trip each and used to
        // dominate the run; this selector is the small, truthful set.
        const triggerLocator = page.locator(
          'main button[aria-haspopup]:visible, main [data-slot="dropdown-menu-trigger"]:visible, main button[aria-expanded]:visible, main [role="button"][aria-haspopup]:visible',
        );
        const triggerCount = Math.min(await triggerLocator.count().catch(() => 0), 12);
        const opened = new Set<string>();
        let overlays = 0;
        for (let ti = 0; ti < triggerCount; ti += 1) {
          if (overlays >= maxInteraction) break;
          const trigger = triggerLocator.nth(ti);
          if (!(await trigger.isVisible({ timeout: 1000 }).catch(() => false))) continue;
          const name = (
            (await trigger.getAttribute('aria-label', { timeout: 2000 }).catch(() => null)) ??
            (await trigger.textContent({ timeout: 2000 }).catch(() => '')) ??
            ''
          )
            .trim()
            .replace(/\s+/g, ' ');
          if (!name || !OPENS.test(name) || DENY_CLICK.test(name)) continue;
          if (opened.has(name)) continue;
          if (
            await trigger
              .evaluate((el) => !!el.closest('[role="menu"],[role="listbox"],[role="menubar"]'))
              .catch(() => false)
          ) {
            continue;
          }
          opened.add(name);
          const hasPopup = await trigger.getAttribute('aria-haspopup', { timeout: 2000 }).catch(() => null);
          if (!hasPopup && !/menu|filter|sort|columns|export|actions|more|view|settings/i.test(name)) continue;
          await trigger.click({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(450);
          const openSelector =
            '[role="dialog"]:visible,[role="menu"]:visible,[role="listbox"]:visible,[role="tooltip"]:visible,[data-slot="select-content"]:visible';
          const open = await page.locator(openSelector).count();
          if (!open) continue;
          overlays += 1;
          const record = await visit(`overlay:${name}`, {
            trigger: await trigger
              .evaluate((el) => {
                const r = el.getBoundingClientRect();
                return {
                  selector:
                    el.getAttribute('data-testid')
                      ? `[data-testid="${el.getAttribute('data-testid')}"]`
                      : el.tagName.toLowerCase(),
                  box: { x: r.left, y: r.top, w: r.width, h: r.height },
                };
              })
              .catch(() => null),
          });
          const countBefore = await page.locator(openSelector).count();
          await page.keyboard.press('Escape');
          await page.waitForTimeout(250);
          const countAfter = await page.locator(openSelector).count();
          const escClosed = countAfter < countBefore;
          const focusReturned = await page.evaluate((label) => {
            const active = document.activeElement as HTMLElement | null;
            if (!active) return false;
            const name = (active.getAttribute('aria-label') ?? active.textContent ?? '').trim();
            return name.includes(label);
          }, name);
          record.probes = { escClosed, focusReturned };
          if (!escClosed) {
            findings.push({
              detector: 'overlays',
              id: 'overlays.esc-does-not-close',
              severity: 'high',
              selector: record.state,
              message: 'Escape does not close the open overlay.',
              evidence: name,
              page: route.page,
              route: route.path,
              state: record.state,
              env: env.name,
              screenshot: record.screenshot,
            });
          }
          if (!focusReturned) {
            findings.push({
              detector: 'overlays',
              id: 'overlays.focus-not-returned',
              severity: 'medium',
              selector: record.state,
              message: 'Focus does not return to the trigger after Escape.',
              evidence: name,
              page: route.page,
              route: route.path,
              state: record.state,
              env: env.name,
              screenshot: record.screenshot,
            });
          }
          if (!escClosed) {
            await page.mouse.click(5, 5).catch(() => {});
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(200);
          }
          await resetPage();
        }

        // 4. Row hover and focus.
        const rowLocator = page.locator('main tbody tr:visible, main [data-finder-row]:visible');
        const rowCount = Math.min(await rowLocator.count().catch(() => 0), options.fast ? 1 : 3);
        for (let index = 0; index < rowCount; index += 1) {
          const row = rowLocator.nth(index);
          if (!(await row.isVisible({ timeout: 1000 }).catch(() => false))) continue;
          await row.hover({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(200);
          await visit(`row-hover:${index + 1}`);
          const focusable = row.locator('a,button').first();
          if (await focusable.count().catch(() => 0)) {
            await focusable.focus({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(200);
            await visit(`row-focus:${index + 1}`);
          }
        }

        // 5. Empty, loading and error states for list pages (full runs only).
        if (!options.fast && /products|orders|users|reviews|carts|contact-messages|notifications/.test(route.path)) {
          let intercepted = false;
          await page.route('**/api/**', async (route) => {
            intercepted = true;
            const url = route.request().url();
            if (route.request().method() !== 'GET') return route.continue();
            if (/stats|unread-count|nav-counts|settings/.test(url)) return route.continue();
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                ...MOCKED_ENVELOPE,
                data: { content: [], totalElements: 0, totalPages: 0, page: 0, size: 20, first: true, last: true },
              }),
            });
          });
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await waitForApp(page);
          if (intercepted) await visit('empty (mocked)');
          await page.unroute('**/api/**').catch(() => {});

          await page.route('**/api/**', async (route) => {
            if (route.request().method() !== 'GET') return route.continue();
            if (/auth|refresh|settings/.test(route.request().url())) return route.continue();
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ ...MOCKED_ENVELOPE, success: false, message: 'finder: mocked 500' }),
            });
          });
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await waitForApp(page);
          await visit('error (mocked)');
          await page.unroute('**/api/**').catch(() => {});

          await page.route('**/api/**', async (route) => {
            if (route.request().method() !== 'GET') return route.continue();
            await new Promise((r) => setTimeout(r, 4000));
            await route.continue().catch(() => {});
          });
          const navigation = page.goto(pageUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await page.waitForTimeout(900);
          await visit('loading (throttled)');
          await navigation;
          await page.unroute('**/api/**').catch(() => {});
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await waitForApp(page);
        }

        // Keep the crawl bounded: one route should not take minutes.
        if (Date.now() - before > 60_000) break;
      }
    }
  } finally {
    logs.stop();
    await browser.close();
  }

  return {
    states,
    findings,
    fingerprints,
    tokens,
    crops,
    apiToken,
    routeGaps: gaps,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

/** Write the raw crawl result next to the report for evidence. */
export function writeCrawl(result: CrawlResult, outDir: string): string {
  const file = resolve(outDir, 'crawl.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(result, null, 1));
  return file;
}
