import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Round 2 — the dashboard home, checked in the browser.
 *
 * What this suite proves, and what it does NOT:
 *
 *  - it proves the NUMBERS are formatted the way the round asked for (one
 *    money formatter, one order number, one count scope);
 *  - it proves the Arabic UI carries no Latin word that is not an
 *    allowlisted proper noun, and that the raw i18n keys never reach the
 *    screen;
 *  - it proves the revenue summary line keeps its order in Arabic (the
 *    date used to come out reversed) — a GEOMETRIC assertion plus a
 *    screenshot of the line;
 *  - it proves the donut centre is readable (the contrast against the
 *    card is measured in the page, not assumed) and that it stays inside
 *    the ring;
 *  - it proves the legend is one column, below the chart, with its
 *    columns aligned;
 *  - it proves the KPI cards share one padding and one baseline, and that
 *    the "New" badge is only on the card where newness is the meaning.
 *
 * It does NOT prove that the numbers are RIGHT — the backend's figures
 * are what they are, and the reconciliation table lives in
 * evidence/dashboard-r2/measurements.json.
 */

/**
 * A raw translation key.
 *
 * Not only the enum-shaped ones (`orders.statuses.DELIVERED`): the
 * lower-case keys are the majority of the app's keys
 * (`dashboard.tabs.origin`), so the check has to catch those too.
 */
const RAW_KEY = /\b[a-z][A-Za-z0-9_]*(\.[a-z][A-Za-z0-9_]*){2,}\b/;

/**
 * The Latin words that may appear in the Arabic UI.
 *
 * A proper noun, a currency code and a unit. Everything else is an
 * untranslated string.
 */
const ALLOWED_LATIN = new Set([
  'macOS',
  'iOS',
  'Linux',
  'Windows',
  'Android',
  'EGP',
  'USD',
  'EUR',
  'GBP',
  'kg',
  // The brand.
  'Nocteon',
  'Coffee',
]);

/** Data, not UI chrome: an order number, an e-mail, a SKU, a number. */
const DATA_PATTERNS = [
  // The order number is one token with the digits split off by the
  // tokenizer, so the prefix is what arrives here.
  /^ORD-/,
  /^[\w.+-]+@[\w-]+\.[\w.]+$/,
  /^SKU-/,
  /^\d/,
];

const OUT = resolve(process.cwd(), 'evidence', 'dashboard-r2', 'e2e');
mkdirSync(OUT, { recursive: true });

/**
 * Wait for a widget to show its data.
 *
 * The API rate-limits, so a request can fail while the suite runs. The
 * widget's own answer is its RETRY button, so the helper uses it — the
 * suite then also proves that the retry recovers. The error state is
 * found by its role, so the helper works in both languages.
 */
async function waitForWidgetData(
  page: Page,
  locator: Locator,
  timeout = 30_000,
): Promise<string> {
  const deadline = Date.now() + timeout;
  let text = '';
  while (Date.now() < deadline) {
    text = await locator.innerText().catch(() => '');
    const alert = locator.locator('[role="alert"]');
    if ((await alert.count()) === 0) return text;
    const retry = locator.locator('button').first();
    if ((await retry.count()) > 0) await retry.click().catch(() => {});
    await page.waitForTimeout(1000);
  }
  return text;
}

/** Switch the language through the app's own control. */
async function switchLanguage(page: Page, target: 'en' | 'ar') {
  const current = await page.evaluate(() => document.documentElement.lang);
  if (current === target) return;
  const trigger = page.locator(
    'app-user-menu[variant="navbar"] button[data-slot="dropdown-menu-trigger"]',
  );
  await trigger.waitFor({ state: 'visible', timeout: 15_000 });
  await trigger.click();
  const item = page.locator('[role="menuitem"]', { hasText: /Language|اللغة/ });
  await item.waitFor({ state: 'visible', timeout: 10_000 });
  await item.click();
  await page.waitForFunction(
    (lang) => document.documentElement.lang === lang,
    target,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(2500);
}

/**
 * The Latin words on the page, with the element they came from.
 *
 * The DATA regions are excluded: a person's name, an order number and an
 * e-mail are data, and a data value in Latin is not an untranslated
 * string. The regions are marked with `data-allow-latin` in the
 * templates.
 */
async function latinWords(page: Page): Promise<{ word: string; where: string }[]> {
  return page.evaluate(() => {
    const out: { word: string; where: string }[] = [];
    const isVisible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (!isVisible(el)) continue;
      if (el.closest('[data-allow-latin]')) continue;
      if (el.children.length > 0) continue;
      const text = (el.textContent || '').trim();
      if (!text) continue;
      const words = text.match(/[A-Za-z][A-Za-z'’-]*/g);
      if (!words) continue;
      const where =
        el.tagName.toLowerCase() +
        (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '');
      // A single letter is an avatar initial, not a word.
      for (const word of words) {
        if (word.length < 2) continue;
        out.push({ word, where });
      }
    }
    return out;
  });
}

test.describe('dashboard — round 2', () => {
  test.setTimeout(180_000);

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    // The backend rate-limits the login to 5/min per identifier, and the
    // other suites in the same run log in too — so the wait is generous and
    // a login that did not land is retried rather than failed.
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      const landed = !page.url().includes('/login');
      if (result.status === 429 || !landed) {
        console.log(`  login attempt ${attempt}: status ${result.status}, landed ${landed} — waiting`);
        await page.waitForTimeout(25_000);
        continue;
      }
      // The login is proven by the URL leaving /login. The ROLE is a soft
      // check: the response body is sometimes already gone by the time it
      // is read (the SPA navigated away), and a null role there is a
      // timing artefact, not an auth failure.
      if (result.role && result.role !== 'ADMIN') {
        throw new Error(`this suite requires an ADMIN account (got ${result.role})`);
      }
      return;
    }
    throw new Error('the login did not succeed after 8 attempts');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(async () => {
    await page.goto('/dashboard?days=30', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  });

  test('the money is formatted ONCE, in both languages', async () => {
    await switchLanguage(page, 'en');
    // The FORMAT, not the value: the seed is re-run from time to time, and
    // a test that pins an amount fails for a reason that is not a defect.
    await expect(page.locator('app-kpi-card').first()).toContainText(/EGP\s?\d{1,3}(,\d{3})*\.\d{2}/);
    const en = await page.locator('app-kpi-card').first().innerText();
    expect(en, 'the English KPI must not print the Latin narrow symbol').not.toContain('E£');

    await switchLanguage(page, 'ar');
    await expect(page.locator('app-kpi-card').first()).toContainText(/\d{1,3}(,\d{3})*\.\d{2}/);
    const ar = await page.locator('app-kpi-card').first().innerText();
    expect(ar, 'the Arabic KPI must print the Arabic symbol').toMatch(/ج\.م/);
    expect(ar, 'the Arabic amount must not carry a trailing full stop').not.toContain('ج.م.');
  });

  test('the order number is the backend number, everywhere', async () => {
    await switchLanguage(page, 'en');
    // The widget loads asynchronously, and the API rate-limits, so the
    // test WAITS for the order number instead of reading the card while it
    // is still empty.
    const recent = await waitForWidgetData(page, page.locator('app-recent-orders'));
    expect(recent, 'the dashboard shows the full order number').toMatch(
      /ORD-\d{4}-\d{6}/,
    );
    expect(recent, 'the dashboard does not print a bare #id').not.toMatch(/#\d+\b/);

    await page.goto('/dashboard/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('app-data-table table')).toContainText(
      /ORD-\d{4}-\d{6}/,
      { timeout: 20_000 },
    );
  });

  test('the count states its scope, on both surfaces', async () => {
    await switchLanguage(page, 'en');
    const tooltip = await page
      .locator('app-kpi-card')
      .nth(1)
      .locator('[data-testid="kpi-scope-note"]')
      .first()
      .getAttribute('title');
    // The rule is the PAYMENT status, not the order status: a delivered
    // order can be refunded, and a cancelled order can be refunded too.
    expect(tooltip, 'the dashboard states which orders it counts').toContain(
      'payment status',
    );
    expect(tooltip, 'and it names the payment statuses it leaves out').toContain(
      'refunded',
    );

    await page.goto('/dashboard/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="orders-scope-note"]')).toBeVisible({
      timeout: 20_000,
    });
    const scope = await page
      .locator('[data-testid="orders-scope-note"]')
      .getAttribute('title');
    expect(scope, 'the orders page states which orders it counts').toContain(
      'cancelled',
    );
    expect(scope, 'the two surfaces count different sets, so the sentences differ').not.toBe(
      tooltip,
    );
  });

  test('the Arabic UI carries no untranslated string', async () => {
    await switchLanguage(page, 'ar');
    // The widgets load asynchronously; the scan waits for the page to
    // settle, so a slow API is not read as an untranslated string.
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    // Every widget that failed is retried, so the scan reads the DATA and
    // not an error message.
    for (const widget of await page.locator('app-recent-orders, app-device-list').all()) {
      await waitForWidgetData(page, widget, 15_000);
    }
    const text = await page.locator('body').innerText();
    expect(text, 'no raw translation key may reach the screen').not.toMatch(RAW_KEY);

    const words = await latinWords(page);
    const allowed = new Set(ALLOWED_LATIN);
    const offenders = words
      .filter(({ word }) => !allowed.has(word))
      .filter(({ word }) => !DATA_PATTERNS.some((pattern) => pattern.test(word)))
      .map(({ word, where }) => `${word} (${where})`);

    expect(
      offenders,
      `untranslated Latin words in the Arabic UI:\n${[...new Set(offenders)].join('\n')}`,
    ).toEqual([]);
  });

  test('the English UI carries no Arabic', async () => {
    await switchLanguage(page, 'en');
    const text = await page.locator('body').innerText();
    expect(text, 'the English UI must not contain Arabic').not.toMatch(/[؀-ۿ]/);
  });

  test('the Arabic summary line keeps its order, and is captured', async () => {
    await switchLanguage(page, 'ar');
    const summary = page.locator('[data-testid="revenue-summary"]');
    await expect(summary).toBeVisible();

    // The date is the last thing in the line, and it is a set of SEPARATE
    // elements: the day, the month and the year. They must be laid out in
    // that order, left to right — the old single string was reordered by
    // the bidi algorithm and came out as "(20 أكتوبر 2026)".
    const parts = await summary.locator('app-localized-date span span').all();
    expect(parts.length, 'the date has three parts').toBeGreaterThanOrEqual(3);
    const boxes = await Promise.all(
      parts.map(async (part) => {
        const box = await part.boundingBox();
        return { text: (await part.innerText()).trim(), x: box?.x ?? 0 };
      }),
    );
    const dateParts = boxes.slice(-3);
    expect(
      dateParts[0].x,
      `the day must be the leftmost part (${JSON.stringify(dateParts)})`,
    ).toBeLessThan(dateParts[1].x);
    expect(
      dateParts[1].x,
      `the month must be between the day and the year (${JSON.stringify(dateParts)})`,
    ).toBeLessThan(dateParts[2].x);

    await summary.screenshot({ path: `${OUT}/summary-line-ar-dark.png` });
  });

  test('the donut centre is readable and stays inside the ring', async () => {
    await switchLanguage(page, 'en');
    const donuts = await page.evaluate(() => {
      const rgb = (value: string) => {
        const m = value.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
        return { r: parts[0], g: parts[1], b: parts[2] };
      };
      const lum = (c: { r: number; g: number; b: number }) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
      };
      const surfaceOf = (el: Element) => {
        let node: Element | null = el;
        while (node && node !== document.documentElement) {
          const c = rgb(getComputedStyle(node).backgroundColor);
          if (c) return c;
          node = node.parentElement;
        }
        return { r: 255, g: 255, b: 255 };
      };
      return Array.from(document.querySelectorAll('app-chart-card')).map((card) => {
        const svg = card.querySelector('svg');
        const label = card.querySelector('[data-testid="donut-center-label"]');
        const value = card.querySelector('[data-testid="donut-center-value"]');
        if (!svg || !label || !value) return null;
        const surface = surfaceOf(card.closest('hlm-card') ?? card);
        const fill = rgb(getComputedStyle(label).fill);
        const l1 = lum(fill ?? surface);
        const l2 = lum(surface);
        const contrast =
          Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
        const svgBox = svg.getBoundingClientRect();
        const hole = (Math.min(svgBox.width, svgBox.height) / 2) * 0.62;
        const valueBox = value.getBoundingClientRect();
        const centreX = svgBox.left + svgBox.width / 2;
        const centreY = svgBox.top + svgBox.height / 2;
        const overflow =
          Math.max(
            Math.abs(valueBox.left + valueBox.width / 2 - centreX),
            Math.abs(valueBox.top + valueBox.height / 2 - centreY),
          ) -
          hole / 2;
        return {
          label: (label.textContent || '').trim(),
          value: (value.textContent || '').trim(),
          contrast,
          overflow: Math.round(overflow * 10) / 10,
          diameter: Math.round(svgBox.width),
        };
      });
    });

    for (const donut of donuts) {
      if (!donut) continue;
      expect(donut.contrast, `the centre of "${donut.label}" must be readable`).toBeGreaterThanOrEqual(4.5);
      expect(donut.overflow, `the centre of "${donut.label}" must stay inside the ring`).toBeLessThan(0);
      expect(donut.diameter, 'every donut has the same diameter').toBe(180);
    }
    const labels = donuts.filter(Boolean).map((d) => d!.label);
    expect(labels, 'the centre says what the number is').toContain('Revenue');
    expect(labels, 'the centre says what the number is').toContain('Orders');
  });

  test('the legend is one column, below the chart, with aligned columns', async () => {
    await switchLanguage(page, 'en');
    const legends = await page.evaluate(() =>
      Array.from(document.querySelectorAll('app-chart-card')).map((card) => {
        const legend = card.querySelector('[data-testid="chart-legend"]');
        const svg = card.querySelector('svg');
        if (!legend) return null;
        const legendBox = legend.getBoundingClientRect();
        const svgBox = svg?.getBoundingClientRect();
        const rows = Array.from(legend.querySelectorAll('li')).map((li) =>
          Array.from(li.children).map((c) => Math.round(c.getBoundingClientRect().left)),
        );
        return {
          rows: rows.length,
          columns: rows[0]?.length ?? 0,
          aligned: rows.every(
            (row) => row.every((left, i) => Math.abs(left - (rows[0]?.[i] ?? 0)) <= 1),
          ),
          below: svgBox ? legendBox.top >= svgBox.bottom - 1 : false,
        };
      }),
    );
    for (const legend of legends) {
      if (!legend) continue;
      expect(legend.columns, 'the legend row has dot, name, value and percent').toBe(4);
      expect(legend.aligned, 'the legend columns are aligned').toBe(true);
      expect(legend.below, 'the legend is below the chart').toBe(true);
    }
  });

  test('the KPI cards share one padding and one baseline', async () => {
    await switchLanguage(page, 'en');
    const cards = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('[data-testid="kpi-primary-row"] app-kpi-card'),
      ).map((card) => {
        const label = card.querySelector('[data-testid="kpi-label"]');
        const value = card.querySelector('[data-testid="stat-value"]');
        const cardBox = card.getBoundingClientRect();
        const labelBox = label?.getBoundingClientRect();
        const valueBox = value?.getBoundingClientRect();
        return {
          labelTop: labelBox ? Math.round(labelBox.top - cardBox.top) : null,
          valueTop: valueBox ? Math.round(valueBox.top - cardBox.top) : null,
          labelFontSize: label ? getComputedStyle(label).fontSize : null,
          valueFontSize: value ? getComputedStyle(value).fontSize : null,
        };
      }),
    );
    expect(cards.length, 'there are four KPI cards').toBe(4);
    const labelTops = new Set(cards.map((c) => c.labelTop));
    const valueTops = new Set(cards.map((c) => c.valueTop));
    expect(labelTops.size, `the labels share one offset (${JSON.stringify(cards)})`).toBe(1);
    expect(valueTops.size, `the values share one baseline (${JSON.stringify(cards)})`).toBe(1);

    // The TYPE, not only the offsets: the four cards read as one set.
    const labelSizes = new Set(cards.map((c) => c.labelFontSize));
    const valueSizes = new Set(cards.map((c) => c.valueFontSize));
    expect(labelSizes.size, `the labels share one size (${JSON.stringify(cards)})`).toBe(1);
    expect(valueSizes.size, `the values share one size (${JSON.stringify(cards)})`).toBe(1);
    expect([...labelSizes][0], 'the KPI label is 13px').toBe('13px');
    expect([...valueSizes][0], 'the KPI value is 28px').toBe('28px');
  });

  test('no comparison means no chip, and "New" only where it means new', async () => {
    await switchLanguage(page, 'en');
    const cards = await page.locator('app-kpi-card').allInnerTexts();

    // The agreed rule: an em dash on four cards in a row says nothing, so a
    // card with no baseline renders NO chip at all.
    for (const card of cards) {
      expect(card, 'no card keeps the empty "—" badge').not.toContain('—');
    }

    // "New" is the meaning on the new-customers card only; every other card
    // that has a real delta shows a signed percentage instead.
    const withNew = cards.filter((text) => /New/.test(text));
    expect(withNew.length, 'at most one card carries the "New" badge').toBeLessThanOrEqual(1);
    for (const card of withNew) {
      expect(card, 'and it is the new-customers card').toContain('New customers');
    }
  });
});
