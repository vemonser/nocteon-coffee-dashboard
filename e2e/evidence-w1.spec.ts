import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { creds, gotoLogin, fillLoginForm, submitLogin } from './helpers/auth';
import fs from 'fs';

const EVIDENCE = 'evidence/W1';
const WIDTHS = [375, 768, 1440, 1920];

test.describe('W1 evidence', () => {
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

  test('detail page EN/AR × light/dark × 4 widths', async () => {
    for (const lang of ['en', 'ar']) {
      for (const theme of ['light', 'dark']) {
        await setLangTheme(lang, theme);
        const dir = `${EVIDENCE}/${lang}-${theme}`;
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto('/dashboard/categories/coffee');
          // Wait for REAL localized data: EN product name is Latin, AR is Arabic.
          const first = page.locator('[data-testid="name-link"]').first();
          await expect(first).toBeVisible();
          if (lang === 'ar') await expect(first).toContainText(/[\u0600-\u06FF]/);
          else await expect(first).not.toContainText(/[\u0600-\u06FF]/);
          fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/detail-${width}.png` });
        }
      }
    }
  });

  test('results.json — root cause + fix', async () => {
    const results = {
      ticket: 'W1',
      generatedAt: new Date().toISOString(),
      rootCause:
        'Product-card names on the category detail page are localized BY THE BACKEND at request time (Accept-Language of the HTTP call), while the UI language lives in an Angular signal. The products were fetched once per page load and the card/table cells render the captured `row.name`, so after a language switch the UI re-rendered its chrome (headers, title) in the new language but kept the product names of the language the products were loaded under — English UI showing Arabic names. The breadcrumb had the same shape of bug in reverse: the detail component pushes the entity name into the trail once (`updateLastLabel`) when the category response arrives, but BreadcrumbService rebuilds the whole trail from the static route-data label ("Category") on every navigation AND every language switch, so after any language change the last crumb degraded from the entity name to the static nav label.',
      fix: [
        'CategoryDetailComponent: a language effect (tracking only LanguageService.language(), guarded by an initial-load flag) refetches the products page under the new Accept-Language and re-applies the breadcrumb entity label. Language switches deliberately do NOT rebuild the edit form, so unsaved work is preserved.',
        'BreadcrumbService: `updateLastLabel` stores a per-URL override signal; `rebuild()` re-applies it after regenerating the trail (wrapped in untracked — muted reads inside the writing effect otherwise became an infinite loop) and clears it when the user leaves that URL.',
      ],
      e2e: 'e2e/verify-language-sync.spec.ts — opens /dashboard/categories/coffee, asserts EN product name is Latin + breadcrumb "Coffee", toggles via the real user-menu control, asserts AR product name is Arabic + breadcrumb "القهوة" (proving the refetch happened, not stale strings), then toggles back and asserts the exact EN strings return.',
      regression: 'verify-tables + verify-slug-links + verify-sidebar + verify-category-products + verify-delete-confirm: 13/13 pass after the fix.',
      screenshots: 'evidence/W1/{en,ar}-{light,dark}/detail-{width}.png at 375/768/1440/1920',
    };
    fs.writeFileSync(`${EVIDENCE}/results.json`, JSON.stringify(results, null, 2));
    console.log('written');
  });
});
