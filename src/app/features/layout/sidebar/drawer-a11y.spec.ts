import { describe, expect, it } from 'vitest';

/**
 * FE-25a — the phone drawer is a MODAL, and it has a name.
 *
 * The sidebar IS the mobile navigation up to 991px, so on a phone and on a
 * 768px tablet it is not a region beside the page — it is a modal sheet over
 * it. Three properties matter and none of them is visible in a screenshot:
 *
 *  1. **The focus stays inside.** The drawer is a `hlm-sheet`, which provides
 *     `BrnDialog` (via `BrnSheet`) → an Angular CDK dialog with
 *     `restoreFocus: true`. CDK owns the focus trap, Escape and the return of
 *     focus to the trigger, so the app must not hand-roll a second trap; what
 *     this test pins is that the drawer really is that component.
 *  2. **It has an accessible name.** An unnamed sheet is announced as an
 *     unnamed "dialog". The name comes from the host (translated) and is bound
 *     to the sheet, because a UI lib owns no copy.
 *  3. **Choosing a page closes it.** Otherwise the drawer stays on top of the
 *     page it just opened, and the reader has to dismiss it to see the result.
 *
 * The BEHAVIOUR still needs a browser pass (Tab round the open drawer, Esc,
 * focus return) — the CDK supplies it and the orchestrator confirms it. This
 * spec fails if any of the three things the app is responsible for is removed.
 */

const libs = import.meta.glob('/libs/ui/{sidebar,sheet}/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const appTemplates = import.meta.glob('/src/app/features/layout/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const locales = import.meta.glob('/public/assets/i18n/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>;

const sidebarLib = libs['/libs/ui/sidebar/src/lib/hlm-sidebar.ts'];
const sheetLib = libs['/libs/ui/sheet/src/lib/hlm-sheet.ts'];
const appSidebar = appTemplates['/src/app/features/layout/sidebar/app-sidebar.component.html'];

describe('mobile drawer (FE-25a)', () => {
  it('loads the sources it claims to check (a guard that reads nothing guards nothing)', () => {
    expect(sidebarLib, 'hlm-sidebar.ts').toBeTruthy();
    expect(sheetLib, 'hlm-sheet.ts').toBeTruthy();
    expect(appSidebar, 'app-sidebar.component.html').toBeTruthy();
  });

  it('renders the drawer as a sheet, which is a CDK dialog with a focus trap', () => {
    // The mobile branch of the sidebar is the sheet, not a styled <div>.
    expect(sidebarLib).toMatch(/isMobile\(\)[\s\S]*?<hlm-sheet/);
    expect(sidebarLib).toMatch(/<hlm-sheet-content/);
    // And the sheet provides BrnDialog from BrnSheet — the CDK-backed modal
    // that owns the trap, Escape and `restoreFocus`.
    expect(sheetLib).toMatch(/provide:\s*BrnDialog/);
    expect(sheetLib).toMatch(/useExisting:\s*forwardRef\(\(\)\s*=>\s*BrnSheet\)/);
    expect(sheetLib).toMatch(/class HlmSheet extends BrnSheet/);
  });

  it('gives the sheet its accessible name from the host, in both languages', () => {
    expect(sidebarLib).toMatch(/\[ariaLabel\]="mobileLabel\(\)"/);
    expect(appSidebar).toMatch(/\[mobileLabel\]="'navigationBar\.mainMenu' \| transloco"/);
    for (const [path, dict] of Object.entries(locales)) {
      const bar = dict['navigationBar'] as Record<string, string> | undefined;
      expect(bar?.['mainMenu'], `${path} navigationBar.mainMenu`).toBeTruthy();
    }
  });

  it('closes the drawer when a page is chosen (every nav link)', () => {
    const links = appSidebar.match(/hlmSidebarMenuButton/g) ?? [];
    const closers = appSidebar.match(/\[closeMobileSidebarOnClick\]="true"/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    expect(closers, 'every sidebar link must close the phone drawer').toHaveLength(
      links.length,
    );
  });
});
