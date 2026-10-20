import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import fs from 'fs';

const EVIDENCE = 'evidence/W3';
const WIDTHS = [375, 768, 1440, 1920];

test.describe('W3 evidence', () => {
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

  test('star renders ONLY on featured products (products list + category detail table), with tooltip + aria-label', async () => {
    await page.goto('/dashboard/products');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await page.waitForTimeout(400);

    // Count rows and stars; star must exist exactly on featured rows.
    const stars = page.locator('tbody [role="img"][aria-label]');
    const starCount = await stars.count();
    // 4 featured rows per the API report; assert it live so drift is visible:
    expect(starCount, 'stars in the products table').toBe(4);
    for (let i = 0; i < starCount; i += 1) {
      await expect(stars.nth(i)).toHaveAttribute('aria-label', /Featured|مميز/);
      await expect(stars.nth(i)).toHaveAttribute('title', /Featured|مميز/);
    }
    // Non-featured rows show a decorative dash with no accessible label.
    const dashes = page.locator('tbody', { hasText: '—' });
    expect(await dashes.count()).toBeGreaterThan(0);

    // Category detail: the products table carries the star in the Featured
    // column — every coffee product in the seed is featured, so all 4 rows
    // show it. (getByRole misses ng-icon hosts in Chromium's AX tree, so
    // assert by attributes instead.)
    await page.goto('/dashboard/categories/coffee');
    await expect(page.locator('main tbody tr').first()).toBeVisible();
    const tableStars = page.locator('main tbody [role="img"][aria-label]');
    await expect(tableStars).toHaveCount(4);
    for (let i = 0; i < 4; i += 1) {
      await expect(tableStars.nth(i)).toHaveAttribute('aria-label', /Featured|مميز/);
      await expect(tableStars.nth(i)).toHaveAttribute('title', /Featured|مميز/);
    }
  });

  test('screenshots — products list + category-detail products table, EN/AR × light/dark × 4 widths', async () => {
    const shots: Array<[string, string]> = [
      ['/dashboard/products', 'products-list'],
      ['/dashboard/categories/coffee', 'category-products'],
    ];
    for (const lang of ['en', 'ar']) {
      for (const theme of ['light', 'dark']) {
        await setLangTheme(lang, theme);
        const dir = `${EVIDENCE}/${lang}-${theme}`;
        for (const [path, name] of shots) {
          for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(path);
            await expect(page.locator('tbody tr').first()).toBeVisible();
            await page.waitForTimeout(250);
            fs.mkdirSync(dir, { recursive: true });
            await page.screenshot({ path: `${dir}/${name}-${width}.png` });
          }
        }
      }
    }
  });

  test('results.json — API findings', async () => {
    const results = {
      ticket: 'W3',
      generatedAt: new Date().toISOString(),
      starContract: {
        implemented: 'shared data-table featured case (star icon ONLY for featured=true, title + aria-label "Featured|مميز", decorative — otherwise). Verified live: products table shows exactly 4 stars (the 4 featured products); the category detail products table (same shared DataTable) shows exactly 4 as well. The card-grid on the category detail page was removed in favour of the table, so the grid star is gone with it.',
        screenshots: 'evidence/W3/{en,ar}-{light,dark}/{products-list,category-products}-{width}.png',
      },
      apiFindings: {
        totalProducts: 7,
        disabledStatusProducts: [],
        note: 'NO product in the seed has status "disabled" — all 7 return active=true. The Status column/filter can never show a Disabled value with this dataset; if the user wanted to SEE the disabled presentation, seed data must change first (no data was changed).',
        featured: ['ethiopia-yirgacheffe', 'colombia-huila', 'kenya-nyeri', 'brazil-mogiana'],
      },
      seedDataReport: {
        suspectedTestData: [
          {
            entity: 'product',
            slug: 'brazil-mogiana',
            image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7',
            finding: 'CONCERT PHOTO — visually verified by downloading the image: a concert crowd with stage lasers, on a coffee product (Deep chocolate and hazelnut). Almost certainly a seed mistake.',
          },
          {
            entity: 'product',
            slug: 'chemex-6cup',
            image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085',
            finding: 'Not a Chemex — three latte cups. Generic coffee image on a brewing-equipment product.',
          },
          {
            entity: 'product',
            slug: 'aeropress',
            image: 'https://images.unsplash.com/photo-1587734195503-904fca47e0e9',
            finding: 'Not an AeroPress — roasted beans in a bowl. Generic coffee image on a brewing-equipment product.',
          },
          {
            entity: 'product',
            slug: 'hario-v60',
            image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574',
            finding: 'Weak match — tea/coffee cup with cookies instead of a V60 dripper.',
          },
          {
            entity: 'product',
            slug: 'ethiopia-yirgacheffe',
            image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd',
            finding: 'Acceptable but generic (latte-art cups); kenya-nyeri likewise (latte cups).',
          },
        ],
        suspectedArabicTypos: [
          {
            term: 'يرقاشيف',
            appearsIn: ["product 'ethiopia-yirgacheffe' → 'إثيوبيا يرقاشيف'", "farm 'Yirgacheffe Farm' → 'مزرعة يرقاشيف'"],
            issue: 'Yirgacheffe is conventionally transliterated ييرغاتشي (or يرغاتشي/ييرغاشيف). يرقاشيف uses ق (qaf) — reads like "Yirqashif". Suspected typo, appears in TWO entities so likely one wrong transliteration propagated.',
          },
          {
            term: 'هاني',
            appearsIn: ["processing-method 'Honey' → 'هاني'"],
            issue: 'هاني reads as the person name "Hani". The established Arabic coffee term is العسلي (honey-processed) or معالجة بالعسل. Suspected mistranslation.',
          },
          {
            term: 'مجففة',
            appearsIn: ["processing-method 'Natural' → 'مجففة'"],
            issue: 'Natural process is conventionally الطبيعية or المجففة بالشمس; bare مجففة (dried) loses the meaning and reads oddly.',
          },
          {
            term: 'تقشير رطب',
            appearsIn: ["processing-method 'Wet Hulled' → 'تقشير رطب'"],
            issue: 'Conventional term is المقشّر الرطب; تقشير رطب (wet peeling) is a literal phrasing, flagged as suspicious.',
          },
        ],
      },
      dataChanged: false,
    };
    fs.writeFileSync(`${EVIDENCE}/results.json`, JSON.stringify(results, null, 2));
    console.log('written');
  });
});
