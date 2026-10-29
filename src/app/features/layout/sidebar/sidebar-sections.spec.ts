import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppSidebarComponent } from './app-sidebar.component';
import { AuthService } from '../../../core/auth/auth.service';
import { NavCountsService } from '../../../core/nav/nav-counts.service';
import { getNavItems } from '../../../shared/data/sidebar-nav-items';

/**
 * FE-25 D4+A — one heading per section, and it is the section name.
 *
 * Before this, every section rendered its label TWICE: `sectionLabels` was never
 * rendered as a heading, and the one collapsible row per section carried a copy of
 * the section name. A reader scanning the nav saw six accordions and no group
 * headings. Now each section is a small group heading (the disclosure control) with
 * its links directly under it.
 *
 * These tests render the real component and pin the parts that are invisible in a
 * screenshot:
 *
 *  - the name is rendered once per section — the heading — and never again as a row;
 *  - the heading is the accessible disclosure control: `aria-expanded` flips,
 *    `aria-controls` points at the panel that actually holds the links, and the
 *    panel's closed state is the one that takes those links out of the tab order;
 *  - a section with no permitted link is not rendered at all (no empty heading);
 *  - the phone-drawer contract survives: every link still closes the drawer.
 */

const DICT: Record<string, string> = {
  'navigationBar.mainMenu': 'Main menu',
  'navigationBar.accountMenu.account': 'Account',
  'navigationBar.accountMenu.language': 'Language',
  'navigationBar.accountMenu.logout': 'Log out',
};

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

/** Permission set driven per test. `can()` is everything for most of them. */
let granted: (permission: string) => boolean = () => true;

const authStub = {
  hasPermission: (permission: string) => granted(permission),
  isLoggedIn: () => false,
  currentUser: signal(null),
  getFullName: () => '',
};

const navCountsStub = {
  badgeFor: () => null,
  ariaLabel: (_route: string, n: number) => `${n} pending`,
};

describe('sidebar sections (FE-25 D4+A)', () => {
  let fixture: ComponentFixture<AppSidebarComponent>;
  let root: HTMLElement;

  const headings = (): HTMLButtonElement[] =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-controls^="sidebar-section-"]'));

  const rows = (): HTMLAnchorElement[] =>
    Array.from(root.querySelectorAll<HTMLAnchorElement>('a[hlmSidebarMenuButton]'));

  const sectionLabels = () => getNavItems('en').sections.map((section) => section.label);

  beforeEach(async () => {
    granted = () => true;
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
          loader: EmptyLoader,
        }),
        { provide: AuthService, useValue: authStub },
        { provide: NavCountsService, useValue: navCountsStub },
      ],
    }).compileComponents();

    TestBed.inject(TranslocoService).setTranslation(DICT, 'en');

    fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders exactly one heading per section, carrying the section label', () => {
    const labels = sectionLabels();
    expect(headings()).toHaveLength(labels.length);
    expect(headings().map((heading) => heading.textContent?.trim())).toEqual(labels);
  });

  it('renders each section label once: the parent row that repeated it is gone', () => {
    const labels = new Set(sectionLabels());

    // The heading is the label…
    for (const heading of headings()) {
      expect(labels.has(heading.textContent?.trim() ?? '')).toBe(true);
    }

    // …and no LINK repeats it. This is the regression the decision removed: the
    // parent row was a link-shaped control whose label was the section name.
    const linkTexts = rows().map((link) => link.textContent?.trim() ?? '');
    for (const label of labels) {
      expect(linkTexts).not.toContain(label);
    }
  });

  it('puts the links directly under the heading, inside the panel it controls', () => {
    for (const heading of headings()) {
      const panelId = heading.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      const panel = root.querySelector<HTMLElement>(`#${panelId}`);
      expect(panel, `panel ${panelId}`).not.toBeNull();
      // The children are the rows of THIS panel, not of a duplicate parent row.
      expect(panel!.querySelectorAll('a[hlmSidebarMenuButton]').length).toBeGreaterThan(0);
    }
  });

  it('toggles its own children: aria-expanded flips and the panel leaves the tab order', () => {
    const heading = headings()[0];
    const panel = root.querySelector<HTMLElement>(`#${heading.getAttribute('aria-controls')}`)!;

    // Every section starts closed (nothing persisted, no matching route in the test).
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    expect(panel.classList).not.toContain('nav-collapse-open');
    expect(panel.querySelector('a[hlmSidebarMenuButton]')).not.toBeNull();

    heading.click();
    fixture.detectChanges();

    expect(heading.getAttribute('aria-expanded')).toBe('true');
    expect(panel.classList).toContain('nav-collapse-open');

    heading.click();
    fixture.detectChanges();

    expect(heading.getAttribute('aria-expanded')).toBe('false');
    expect(panel.classList).not.toContain('nav-collapse-open');
  });

  it('toggles only its own section, so the others keep their state', () => {
    const [first, second] = headings();

    first.click();
    fixture.detectChanges();

    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(second.getAttribute('aria-expanded')).toBe('false');
  });

  it('restores a persisted section, so the open/closed choice survives a reload', () => {
    // The component reads storage when it is constructed, hence a second fixture.
    localStorage.setItem('nocteon-sidebar-sections-open', JSON.stringify(['catalog']));
    const reopened = TestBed.createComponent(AppSidebarComponent);
    reopened.detectChanges();

    const catalogHeading = Array.from(
      (reopened.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'button[aria-controls^="sidebar-section-"]',
      ),
    ).find((heading) => heading.textContent?.trim() === 'Catalog');

    expect(catalogHeading, 'Catalog heading').toBeTruthy();
    expect(catalogHeading!.getAttribute('aria-expanded')).toBe('true');
  });

  it('drops a section whose links are all filtered out — never an empty heading', () => {
    // A fresh instance, because the visible rows are a computed over the permission set.
    // Only the two Operations permissions are granted, so every other section has no
    // permitted row and must vanish — including `Access`, whose parent node carries no
    // permission of its own and must not fall back to a row that repeats the heading.
    granted = (permission) => permission === 'order:read' || permission === 'cart:read_all';
    const filtered = TestBed.createComponent(AppSidebarComponent);
    filtered.detectChanges();
    const filteredRoot = filtered.nativeElement as HTMLElement;

    const filteredHeadings = Array.from(
      filteredRoot.querySelectorAll<HTMLButtonElement>('button[aria-controls^="sidebar-section-"]'),
    ).map((heading) => heading.textContent?.trim());
    const filteredRows = Array.from(
      filteredRoot.querySelectorAll<HTMLAnchorElement>(
        '[id^="sidebar-section-"][id$="-panel"] a[hlmSidebarMenuButton]',
      ),
    ).map((link) => link.textContent?.trim());

    expect(filteredHeadings).toEqual(['Operations']);
    expect(filteredRows).toEqual(['Orders', 'Carts']);
  });

  it('keeps the drawer contract: every rendered row is a link inside its section panel', () => {
    // The template pins `[closeMobileSidebarOnClick]="true"` on every link (see
    // drawer-a11y.spec.ts); this side pins that the rendered rows are real links and
    // that each one sits in the panel its heading controls — the structure that made
    // the old parent row redundant.
    const panelRows = Array.from(
      root.querySelectorAll<HTMLAnchorElement>(
        '[id^="sidebar-section-"][id$="-panel"] a[hlmSidebarMenuButton]',
      ),
    );
    expect(panelRows.length).toBeGreaterThan(0);
    for (const link of panelRows) {
      expect(link.getAttribute('href')).toBeTruthy();
      expect(link.closest('[id^="sidebar-section-"][id$="-panel"]')).not.toBeNull();
    }
    // Nothing outside a panel carries a row: the logo and pinned Home are the only
    // other sidebar links.
    expect(rows().length - panelRows.length).toBe(2);
  });
});
