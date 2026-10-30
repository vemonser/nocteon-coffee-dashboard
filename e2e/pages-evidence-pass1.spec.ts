import { test, type Page, type Locator } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupCreated, recordCreated, testName } from './helpers/test-data';

/**
 * Pages pass 1 evidence. ONE login (the backend rate-limits it), then every
 * touched page and dialog in light-en, dark-en and light-ar at 1440×900.
 *
 * Writes:
 *   evidence/pages/pass1/*.png      — viewport screenshots (never full-page)
 *   evidence/pages/pass1/results.json — the measured checks (a)–(f)
 */

const EMAIL = process.env['E2E_ADMIN_EMAIL']!;
const PASSWORD = process.env['E2E_ADMIN_PASSWORD']!;
const API = (process.env['E2E_API_URL'] ?? 'http://localhost:8080').replace(/\/+$/, '');
const OUT = join(process.cwd(), 'evidence/pages/pass1');

type Mode = 'light-en' | 'dark-en' | 'light-ar';
const MODES: Mode[] = ['light-en', 'dark-en', 'light-ar'];

const LISTS = [
  { key: 'pairings', path: '/dashboard/pairings', add: 'Add pairing', testId: 'pairing-dialog' },
  { key: 'origins', path: '/dashboard/origins', add: 'Add origin', testId: 'origin-dialog' },
  { key: 'farms', path: '/dashboard/farms', add: 'Add farm', testId: 'farm-dialog' },
  { key: 'roast-levels', path: '/dashboard/roast-levels', add: 'Add roast level', testId: 'roast-level-dialog' },
  { key: 'processing-methods', path: '/dashboard/processing-methods', add: 'Add processing method', testId: 'processing-method-dialog' },
  { key: 'coffee-varieties', path: '/dashboard/coffee-varieties', add: 'Add coffee variety', testId: 'coffee-variety-dialog' },
  { key: 'tasting-notes', path: '/dashboard/tasting-notes', add: 'Add tasting note', testId: 'tasting-note-dialog' },
  { key: 'brewing-methods', path: '/dashboard/brewing-methods', add: 'Add brewing method', testId: 'brewing-method-dialog' },
] as const;

const DETAILS = [
  { key: 'origin-detail', path: '/dashboard/origins/ethiopia' },
  { key: 'roast-level-detail', path: '/dashboard/roast-levels/light' },
  { key: 'processing-detail', path: '/dashboard/processing-methods/washed' },
  { key: 'tasting-note-detail', path: '/dashboard/tasting-notes/chocolate' },
] as const;

const results: any = {
  mode: 'pages-fixes-pass1',
  viewport: '1440x900',
  generatedAt: new Date().toISOString(),
  checks: {},
  screenshots: [] as string[],
};

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: 'serial' });

async function setMode(page: Page, mode: Mode): Promise<void> {
  const lang = mode.endsWith('ar') ? 'ar' : 'en';
  const theme = mode.startsWith('dark') ? 'dark' : 'light';
  await page.evaluate(
    ([l, t]) => {
      localStorage.setItem('language', l);
      localStorage.setItem('nocteon-theme', t);
    },
    [lang, theme] as const,
  );
}

async function shot(page: Page, mode: Mode, name: string): Promise<string> {
  const file = `${name}-${mode}.png`;
  await page.screenshot({ path: join(OUT, file) });
  results.screenshots.push(`evidence/pages/pass1/${file}`);
  return file;
}

/**
 * Navigate to a data page and wait for its first load. A dev backend under a
 * long evidence run occasionally answers one request with an error; the page's
 * own Retry is the honest way out (the same button a reader uses).
 */
async function gotoData(page: Page, path: string, wait = 1000): Promise<void> {
  await page.goto(path);
  await page.waitForTimeout(wait);
  const retry = page.locator('main button').filter({ hasText: /Retry|إعادة المحاولة/ }).first();
  if (await retry.isVisible().catch(() => false)) {
    await retry.click();
    await page.waitForTimeout(wait + 400);
  }
}

/** Background images on the page shell + any faint large illustration. */
async function backgroundAudit(page: Page) {
  return page.evaluate(() => {
    const selectors = ['html', 'body', 'app-root', 'main', 'app-layout', '.page-shell'];
    const shell = selectors.map((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return { sel, missing: true };
      const cs = getComputedStyle(el);
      const before = getComputedStyle(el, '::before');
      const after = getComputedStyle(el, '::after');
      return {
        sel,
        bg: cs.backgroundImage,
        before: before.backgroundImage,
        after: after.backgroundImage,
      };
    });

    const backgrounds: any[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      const cs = getComputedStyle(el);
      for (const pseudo of [null, '::before', '::after'] as const) {
        const s = pseudo ? getComputedStyle(el, pseudo) : cs;
        if (s.backgroundImage && s.backgroundImage !== 'none') {
          backgrounds.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 60),
            pseudo,
            bg: s.backgroundImage.slice(0, 80),
          });
        }
      }
    }

    const faint = Array.from(document.querySelectorAll<HTMLElement>('img, svg'))
      .map((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          opacity: Number(cs.opacity),
          ratio: (r.width * r.height) / (window.innerWidth * window.innerHeight),
        };
      })
      .filter((i) => i.opacity < 0.3 && i.ratio > 0.1);

    return { shell, backgrounds, faint };
  });
}

function allShellsClear(audit: Awaited<ReturnType<typeof backgroundAudit>>): boolean {
  return audit.shell.every(
    (s) => !s.missing && s.bg === 'none' && s.before === 'none' && s.after === 'none',
  );
}

test('pages pass 1 evidence', async ({ page, request }) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  await page.goto('/login');
  await page.locator('#identifier').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.waitForTimeout(800);

  // ── (a) fixtures: 12 trashed pairings, so the badge has a real count ────────
  const apiLogin = await request.post(`${API}/api/auth/login`, {
    data: { identifier: EMAIL, password: PASSWORD },
  });
  const token = (await apiLogin.json()).data.accessToken as string;
  const headers = { Authorization: `Bearer ${token}` };
  for (let i = 1; i <= 12; i++) {
    const name = testName(`pairing-evidence-${i}`);
    const created = await request.post(`${API}/api/dashboard/pairings`, {
      headers,
      multipart: {
        data: {
          name: 'data',
          mimeType: 'application/json',
          buffer: Buffer.from(
            JSON.stringify({
              translations: [
                { language: 'en', name },
                { language: 'ar', name: `إقران ${i}` },
              ],
            }),
          ),
        },
      },
    });
    const data = (await created.json()).data;
    recordCreated({ entity: 'pairings', id: data.id, slug: data.slug, name });
    await request.delete(`${API}/api/dashboard/pairings/${data.slug}`, { headers });
  }

  const trashTotal = (
    await (await request.get(`${API}/api/dashboard/pairings/deleted?size=1`, { headers })).json()
  ).data.totalElements as number;

  // ── per mode ───────────────────────────────────────────────────────────────
  const auditByMode: Record<string, any> = {};

  for (const mode of MODES) {
    await page.goto('/dashboard');
    await setMode(page, mode);
    await page.goto('/dashboard');
    await page.waitForTimeout(1200);

    // (b) every group heading is the ONE style: same class set, no icon.
    if (mode === 'light-en' || mode === 'light-ar') {
      const groups = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-controls^="sidebar-section-"]')).map(
          (h) => {
            const cs = getComputedStyle(h);
            return {
              label: (h.textContent ?? '').trim(),
              className: h.className,
              textTransform: cs.textTransform,
              letterSpacing: cs.letterSpacing,
              fontSize: cs.fontSize,
              icons: Array.from(h.querySelectorAll('ng-icon')).map((i) => i.getAttribute('name')),
              hasLeadingIcon: h.firstElementChild?.tagName.toLowerCase() === 'ng-icon',
            };
          },
        ),
      );
      const classSets = new Set(groups.map((g: any) => g.className));
      results.checks[`b_sidebar_groups_${mode}`] = {
        groups,
        distinctClassSets: classSets.size,
        anyLeadingIcon: groups.some((g: any) => g.hasLeadingIcon),
        pass: classSets.size === 1 && !groups.some((g: any) => g.hasLeadingIcon),
      };
      await shot(page, mode, 'p2-sidebar-groups');
    }

    // P1: every list page + its create dialog.
    const audits: Record<string, any> = {};
    for (const list of LISTS) {
      await gotoData(page, list.path);
      await shot(page, mode, `p1-${list.key}-list`);

      const audit = await backgroundAudit(page);
      audits[list.path] = { shellClear: allShellsClear(audit), backgrounds: audit.backgrounds };

      const add = page
        .locator('main button')
        .filter({ has: page.locator('ng-icon[name="lucidePlus"]') })
        .first();

      // P1: the bulk bar and the row kebab menu, in one shot each (light-en).
      if (mode === 'light-en' && list.key === 'pairings') {
        const boxes = page.locator('main tbody input[type="checkbox"]');
        await boxes.nth(0).check();
        await boxes.nth(1).check();
        await page.waitForTimeout(300);
        await shot(page, mode, 'p1-bulk-bar');
        await boxes.nth(0).uncheck();
        await boxes.nth(1).uncheck();
        await page.waitForTimeout(300);
        await page.locator('main tbody tr').first().locator('button[aria-label="Actions"]').click();
        await page.waitForTimeout(400);
        await shot(page, mode, 'p1-row-menu');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      await add.click();
      await page.waitForTimeout(400);
      const dialog = page.locator(`[data-testid="${list.testId}"]`);
      if (await dialog.isVisible()) {
        await shot(page, mode, `p1-${list.key}-dialog`);
        const dAudit = await backgroundAudit(page);
        audits[`${list.path}#dialog`] = {
          shellClear: allShellsClear(dAudit),
          backgrounds: dAudit.backgrounds,
        };
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    // P1: the trash tab badge and the Deleted cell.
    await gotoData(page, '/dashboard/pairings');
    const trashTab = page.locator('#lifecycle-tab-trash');
    await trashTab.click();
    await page.waitForTimeout(1000);
    await shot(page, mode, 'p1-pairings-trash');
    if (mode === 'light-en') {
      const badge = (await trashTab.innerText()).replace(/\s+/g, ' ').trim();
      const deleted = (
        await page.locator('main tbody tr').first().locator('td[data-column="deleted"]').innerText()
      ).trim();
      results.checks.a_trash_badge = {
        badgeText: badge,
        apiTotal: trashTotal,
        deletedCell: deleted,
        pass: badge.endsWith(String(trashTotal)),
      };
    }
    await page.locator('#lifecycle-tab-active').click().catch(() => {});
    await page.waitForTimeout(600);

    // P2: the Store group's breadcrumb (Shipping zones).
    if (mode === 'light-en') {
      await gotoData(page, '/dashboard/shipping-zones');
      await shot(page, mode, 'p2-store-breadcrumb-shipping');
    }

    // P3: the page the watermark report named, and its dialog.
    await gotoData(page, '/dashboard/product-tags');
    await shot(page, mode, 'p3-tags');
    await page
      .locator('main button')
      .filter({ has: page.locator('ng-icon[name="lucidePlus"]') })
      .first()
      .click();
    await page.waitForTimeout(400);
    await shot(page, mode, 'p3-tags-dialog');
    const tagsAudit = await backgroundAudit(page);
    audits['/dashboard/product-tags#dialog'] = {
      shellClear: allShellsClear(tagsAudit),
      backgrounds: tagsAudit.backgrounds,
      faint: tagsAudit.faint,
    };
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // P4: product options + the open "Add value" popover.
    await gotoData(page, '/dashboard/product-options');
    await shot(page, mode, 'p4-product-options');
    const chip = page.locator('main .font-mono').first();
    const trigger = page.locator('main button').filter({ hasText: /Add value|إضافة قيمة/ }).first();
    const triggerBox = (await trigger.boundingBox())!;
    await trigger.click();
    await page.waitForTimeout(500);
    const popover = page
      .locator('[role="dialog"]')
      .filter({ has: page.locator('form') })
      .last();
    await shot(page, mode, 'p4-add-value-popover');
    const pBox = (await popover.boundingBox())!;
    const offset = pBox.y - (triggerBox.y + triggerBox.height);
    const chipFont = await chip.evaluate((el) => getComputedStyle(el).fontFamily);
    if (mode === 'light-en') {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const focused = await trigger.evaluate((el) => el === document.activeElement);
      results.checks.c_popover = {
        triggerBottom: triggerBox.y + triggerBox.height,
        popoverTop: pBox.y,
        offset,
        alignedStart: Math.abs(pBox.x - triggerBox.x) <= 2,
        pass: offset >= 7 && offset <= 9 && Math.abs(pBox.x - triggerBox.x) <= 2,
      };
      results.checks.p4 = { chipText: (await chip.innerText()).trim(), chipFont, focusReturned: focused };
      await page.keyboard.press('Escape');
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(300);

    // P5: products list (star + range price).
    await gotoData(page, '/dashboard/products');
    await shot(page, mode, 'p5-products-list');
    if (mode === 'light-en') {
      const star = page.locator('main td[data-column="featured"] ng-icon[name="heroStarSolid"]').first();
      const starColor = await star.evaluate((el) => getComputedStyle(el).color);
      const prices = (await page.locator('main td[data-column="productPrice"]').allTextContents()).map((t) =>
        t.replace(/[\u2066\u2069]/g, '').replace(/\s+/g, ' ').trim(),
      );
      results.checks.p5 = {
        starColor,
        prices,
        pass: starColor === 'rgb(138, 75, 34)' && prices.every((p) => (p.match(/EGP/g) ?? []).length === 1),
      };

      const listStatuses: Record<string, string> = {};
      const rows = page.locator('main tbody tr');
      for (let i = 0; i < (await rows.count()); i++) {
        const name = (await rows.nth(i).locator('td[data-column="main_en"]').innerText()).split('\n')[0].trim();
        listStatuses[name] = (await rows.nth(i).locator('td[data-column="isActive"]').innerText()).trim();
      }
      results.checks._listStatuses = listStatuses;
    }

    // P6: the category page, its status column, layout and confirm dialog.
    await gotoData(page, '/dashboard/categories/coffee', 1400);
    await shot(page, mode, 'p6-category-detail');

    const catRows = page.locator('main app-data-table tbody tr');
    const catStatuses: Record<string, string> = {};
    if (mode === 'light-en') {
      for (let i = 0; i < (await catRows.count()); i++) {
        const name = (await catRows.nth(i).locator('td[data-column^="main_"]').innerText())
          .split('\n')[0]
          .trim();
        catStatuses[name] = (await catRows.nth(i).locator('td[data-column="isActive"]').innerText()).trim();
      }
    }
    if (mode === 'light-en') {
      const expected = results.checks._listStatuses as Record<string, string>;
      const mismatches = Object.entries(catStatuses).filter(([name, status]) => expected[name] !== status);
      results.checks.d_category_status = {
        category: catStatuses,
        productsList: expected,
        mismatches,
        pass: Object.keys(catStatuses).length === 4 && mismatches.length === 0,
      };
      const card = page.locator('main hlm-card').first();
      const cardBox = (await card.boundingBox())!;
      const back = page
        .locator('main button')
        .filter({ has: page.locator('ng-icon[name="lucideArrowLeft"]') })
        .first();
      const backBox = (await back.boundingBox())!;
      results.checks.p6_layout = {
        imageCard: { width: cardBox.width, height: cardBox.height, ratio: cardBox.width / cardBox.height },
        backButton: { width: backBox.width, height: backBox.height },
        pass:
          cardBox.width <= 320.5 &&
          Math.abs(cardBox.width / cardBox.height - 4 / 3) < 0.06 &&
          Math.round(backBox.width) === 36,
      };
    }
    await page.locator('main button').filter({ hasText: /Move to trash|نقل إلى المهملات/ }).first().click();
    await page.waitForTimeout(400);
    await shot(page, mode, 'p6-move-to-trash-confirm');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // P7: store settings, pristine and dirty.
    await gotoData(page, '/dashboard/store-settings');
    await shot(page, mode, 'p7-store-settings-pristine');
    const save = page.locator('main form button[type="submit"]');
    if (mode === 'light-en') {
      results.checks.f_save_disabled = {
        pristineSaveDisabled: await save.isDisabled(),
        pass: await save.isDisabled(),
      };
    }
    const threshold = page.locator('#freeShippingThreshold');
    const original = await threshold.inputValue();
    await threshold.fill(String(Number(original) + 10));
    await threshold.blur();
    await page.waitForTimeout(300);
    await shot(page, mode, 'p7-store-settings-dirty');
    // Discard before leaving, or the unsaved-changes guard holds the page.
    const discard = page.locator('main form button').filter({ hasText: /Discard|تجاهل/ }).first();
    if (await discard.isVisible().catch(() => false)) await discard.click();
    await page.waitForTimeout(300);
    await page.goto('/dashboard');

    // P8: the dated detail pages.
    for (const detail of DETAILS) {
      await gotoData(page, detail.path);
      await shot(page, mode, `p8-${detail.key}`);
    }

    auditByMode[mode] = audits;
  }

  // (e) no background image on html/body/app-root/main/layout wrappers.
  const allAudits = Object.values(auditByMode).flatMap((m) => Object.values(m as object));
  results.checks.e_backgrounds = {
    auditedTargets: allAudits.length,
    shellClear: allAudits.every((a: any) => a.shellClear === true),
    unexpectedBackgrounds: allAudits
      .flatMap((a: any) => a.backgrounds ?? [])
      .filter((b: any) => !String(b.cls).includes('sidebar-scroll-fade') && b.tag !== 'body' && b.tag !== 'html'),
    faint: allAudits.flatMap((a: any) => a.faint ?? []),
    pass:
      allAudits.every((a: any) => a.shellClear === true) &&
      allAudits.flatMap((a: any) => a.faint ?? []).length === 0,
  };

  delete results.checks._listStatuses;
  writeFileSync(join(OUT, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  await cleanupCreated();
});
