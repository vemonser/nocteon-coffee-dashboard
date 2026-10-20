import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import fs from 'fs';

const EVIDENCE = 'evidence/W6';

const LISTS = [
  ['categories', '/dashboard/categories'],
  ['origins', '/dashboard/origins'],
  ['farms', '/dashboard/farms'],
  ['roast-level', '/dashboard/roast-levels'],
  ['processing-method', '/dashboard/processing-methods'],
  ['coffee-variety', '/dashboard/coffee-varieties'],
  ['tasting-note', '/dashboard/tasting-notes'],
  ['brewing-method', '/dashboard/brewing-methods'],
  ['pairing', '/dashboard/pairings'],
  ['products', '/dashboard/products'],
] as Array<[string, string]>;

test.describe('W6 evidence', () => {
  // Mass-navigating ~200 pages: the default 60s per test is far too low.
  test.setTimeout(20 * 60 * 1000);

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await gotoLogin(page);
      await fillLoginForm(page, creds.adminEmail, creds.adminPassword);
      const result = await submitLogin(page);
      if (result.status === 429) {
        await page.waitForTimeout(20_000);
        continue;
      }
      expect(result.role).toBe('ADMIN');
      return;
    }
    throw new Error('login stayed rate-limited (429) after 3 attempts');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  async function setLangTheme(lang: string, theme: string): Promise<void> {
    await page.evaluate(([l, t]) => {
      localStorage.setItem('language', l as string);
      localStorage.setItem('nocteon-theme', t as string);
    }, [lang, theme]);
  }

  /** Open a list, click its identity link once, land on the detail page. */
  async function openFirstDetail(listPath: string): Promise<string> {
    await page.goto(listPath);
    const link = page.locator('[data-testid="name-link"]').first();
    try {
      await link.waitFor({ timeout: 15_000 });
    } catch (e) {
      const dir = `${EVIDENCE}/debug`;
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: `${dir}/no-name-link-${Date.now()}.png` });
      fs.writeFileSync(
        `${dir}/state-${Date.now()}.json`,
        JSON.stringify({
          url: page.url(),
          rows: await page.locator('tbody tr').count(),
          links: await page.locator('[data-testid="name-link"]').count(),
        }),
      );
      throw e;
    }
    const href = await link.getAttribute('href');
    if (!href) throw new Error(`no href on ${listPath}`);
    return href;
  }

  test('overflow sweep — every list + detail page at 375 and 768, EN + AR', async () => {
    const report: Array<Record<string, unknown>> = [];
    const names = new Set<string>();

    for (const lang of ['en', 'ar']) {
      await setLangTheme(lang, 'light');
      for (const [name, path] of LISTS) {
        for (const width of [375, 768]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(path);
          await expect(page.locator('tbody tr').first()).toBeVisible();
          await page.waitForTimeout(200);

          const overflow = await page.evaluate(() => {
            const vw = window.innerWidth;
            const doc = document.scrollingElement as HTMLElement;
            const pageOverflow = Math.max(0, doc.scrollWidth - doc.clientWidth);
            // Offenders must NOT be mere contents of an internal scroll
            // container: skip any element with an ancestor that actually
            // scrolls horizontally (that is a contained table by design).
            const inScroller = (el: HTMLElement): boolean => {
              let cur: HTMLElement | null = el.parentElement;
              while (cur) {
                const cs = getComputedStyle(cur);
                if (['auto', 'scroll'].includes(cs.overflowX) && cur.scrollWidth > cur.clientWidth + 1) {
                  return true;
                }
                cur = cur.parentElement;
              }
              return false;
            };
            const offenders: string[] = [];
            for (const el of document.querySelectorAll('main *')) {
              const r = (el as HTMLElement).getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              if (r.right > vw + 1 || r.left < -1) {
                if (inScroller(el as HTMLElement)) continue;
                const cls = String((el as HTMLElement).className?.baseVal ?? el.className).split(' ').slice(0, 3).join('.');
                offenders.push(`${el.tagName.toLowerCase()}.${cls}`);
                if (offenders.length >= 5) break;
              }
            }
            return { pageOverflow, offenders };
          });
          report.push({ page: name, lang, width, ...overflow });
          if (overflow.pageOverflow > 0 || overflow.offenders.length) {
            names.add(`${name}@${width}/${lang}`);
          }
        }
        // Detail page at the same widths (via the row's own link).
        // products has no detail route/no name-link by design — skip it.
        if (name === 'products') continue;
        const detailHref = await openFirstDetail(path);
        for (const width of [375, 768]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(detailHref);
          await expect(page.locator('main').first()).toBeVisible();
          await page.waitForTimeout(600);
          const overflow = await page.evaluate(() => {
            const vw = window.innerWidth;
            const doc = document.scrollingElement as HTMLElement;
            const pageOverflow = Math.max(0, doc.scrollWidth - doc.clientWidth);
            const inScroller = (el: HTMLElement): boolean => {
              let cur: HTMLElement | null = el.parentElement;
              while (cur) {
                const cs = getComputedStyle(cur);
                if (['auto', 'scroll'].includes(cs.overflowX) && cur.scrollWidth > cur.clientWidth + 1) {
                  return true;
                }
                cur = cur.parentElement;
              }
              return false;
            };
            const offenders: string[] = [];
            for (const el of document.querySelectorAll('main *')) {
              const r = (el as HTMLElement).getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              if (r.right > vw + 1 || r.left < -1) {
                if (inScroller(el as HTMLElement)) continue;
                const cls = String((el as HTMLElement).className?.baseVal ?? el.className).split(' ').slice(0, 3).join('.');
                offenders.push(`${el.tagName.toLowerCase()}.${cls}`);
                if (offenders.length >= 5) break;
              }
            }
            return { pageOverflow, offenders };
          });
          report.push({ page: `${name}/detail`, lang, width, ...overflow });
          if (overflow.pageOverflow > 0 || overflow.offenders.length) {
            names.add(`${name}/detail@${width}/${lang}`);
          }
        }
      }
    }

    fs.mkdirSync(EVIDENCE, { recursive: true });
    fs.writeFileSync(`${EVIDENCE}/overflow-sweep.json`, JSON.stringify(report, null, 2));
    console.log('OVERFLOW-PAGES>>>', JSON.stringify([...names]));
    expect(report.length).toBeGreaterThan(70);
  });

  test('screenshots — AR detail light+dark at 4 widths (all catalog details) + lists 375/768', async () => {
    // Arabic detail pages, light + dark, all four widths.
    for (const theme of ['light', 'dark']) {
      await setLangTheme('ar', theme);
      for (const [name, path] of LISTS.slice(1, 9)) {
        const href = await openFirstDetail(path);
        for (const width of [375, 768, 1440, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(href);
          await expect(page.locator('main').first()).toBeVisible();
          await page.waitForTimeout(600);
          const dir = `${EVIDENCE}/ar-${theme}`;
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${name}-detail-${width}.png` });
        }
      }
      // Lists at the two narrow widths in Arabic.
      for (const [name, path] of LISTS) {
        for (const width of [375, 768]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(path);
          await expect(page.locator('main').first()).toBeVisible();
          await page.waitForTimeout(600);
          const dir = `${EVIDENCE}/ar-${theme}`;
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${name}-list-${width}.png` });
        }
      }
    }

    // EN details (1440/1920 wide only — 375/768 lists are captured above and
    // earlier tickets hold the EN detail shots).
    await setLangTheme('en', 'light');
    for (const [name, path] of LISTS.slice(1, 9)) {
      const href = await openFirstDetail(path);
      for (const width of [1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(href);
        await expect(page.locator('main').first()).toBeVisible();
        await page.waitForTimeout(600);
        const dir = `${EVIDENCE}/en-light`;
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: `${dir}/${name}-detail-${width}.png` });
      }
    }
  });

  test('screenshots — Add dialog AR (light + dark) and EN dark', async () => {
    const shots: Array<[string, string]> = [
      ['ar', 'light'],
      ['ar', 'dark'],
      ['en', 'dark'],
    ];
    for (const [lang, theme] of shots) {
      await setLangTheme(lang, theme);
      for (const width of [1440, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/dashboard/categories');
        await expect(page.locator('tbody tr').first()).toBeVisible();
        const addBtn = page.getByRole('button', { name: /Add|إضافة/ }).first();
        await addBtn.click();
        const dialog = page.locator('[role="dialog"], hlm-dialog-content, form').first();
        await expect(dialog).toBeVisible();
        await page.waitForTimeout(300);
        const dir = `${EVIDENCE}/${lang}-${theme}`;
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: `${dir}/add-dialog-${width}.png` });
        // Close (Escape) for the next iteration.
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  });

  test('results.json — overflow findings + coverage map', async () => {
    const sweep = JSON.parse(fs.readFileSync(`${EVIDENCE}/overflow-sweep.json`, 'utf-8')) as Array<
      Record<string, unknown>
    >;
    const dirty = sweep.filter(
      (r) => Number(r.pageOverflow) > 0 || (Array.isArray(r.offenders) && r.offenders.length > 0),
    );
    const results = {
      ticket: 'W6',
      generatedAt: new Date().toISOString(),
      captureOnly: true,
      captures: {
        arabicDetailsLightDark: 'evidence/W6/{ar-light,ar-dark}/<entity>-detail-{375,768,1440,1920}.png',
        listsAtNarrowWidths: 'evidence/W6/{ar-light,ar-dark}/<entity>-list-{375,768}.png',
        enDetailsWide: 'evidence/W6/en-light/<entity>-detail-{1440,1920}.png',
        addDialog: 'evidence/W6/{ar-light,ar-dark,en-dark}/add-dialog-{1440,375}.png',
      },
      earlierTicketsFilled: 'AR category detail {light,dark}×4 widths landed with W5 (evidence/W5); EN details + categories were captured in W1–W4.',
      overflowSweep: {
        checked: `${sweep.length} page/viewport/language combinations (10 lists × {list,detail} × {375,768} × {en,ar})`,
        overflowFindings: dirty,
        verdict: dirty.length === 0 ? 'CLEAN — no horizontal overflow anywhere' : `${dirty.length} combinations overflow — see findings`,
      },
      dataChanged: false,
    };
    fs.writeFileSync(`${EVIDENCE}/results.json`, JSON.stringify(results, null, 2));
    console.log('VERDICT:', results.overflowSweep.verdict);
  });
});
