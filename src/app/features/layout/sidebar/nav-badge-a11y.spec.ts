import { Injectable, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { HlmSidebarService } from '@spartan-ng/helm/sidebar';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppSidebarComponent } from './app-sidebar.component';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Language } from '../../../core/i18n/language';
import { NavCountsService, type NavBadge } from '../../../core/nav/nav-counts.service';

/**
 * The badge's accessible name belongs to the TRANSLATION layer.
 *
 * The badge is a number in a pill (or, in the rail, a dot) with no text of its
 * own, so the aria-label IS what a screen reader hears. It used to be built in
 * TypeScript — `${n} pending` for orders, carts and reviews — which meant an
 * Arabic UI announced an English sentence, and the sentence was not in the
 * locale files at all.
 *
 * These tests render the real sidebar against the REAL dictionaries and pin
 * the three things that were broken:
 *
 *  1. the name is worded by the active language (English is not the default);
 *  2. it uses the Arabic plural CATEGORY of the count — 1 / 2 / 3 / 11 / 100
 *     are five different sentences, not the number plus one fixed word;
 *  3. it follows a runtime language switch on the SAME instance, so the name
 *     cannot be a string captured once (that is what a field would do).
 *
 * The rail-collapsed dot keeps the same name, and a zero count still shows no
 * badge at all.
 */

type Dict = Record<string, unknown>;

const locales = import.meta.glob('/public/assets/i18n/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Dict>;

const en = locales['/public/assets/i18n/en.json'];
const ar = locales['/public/assets/i18n/ar.json'];

const ROUTES = {
  orders: '/dashboard/orders',
  carts: '/dashboard/carts',
  reviews: '/dashboard/reviews',
  contact: '/dashboard/contact-messages',
} as const;

type Kind = keyof typeof ROUTES;

/**
 * The counts the stub serves, as a SIGNAL — exactly like the real service, so
 * the template really re-renders when a poll changes a number (a plain object
 * would leave the OnPush sidebar stale).
 */
const counts = signal<Record<Kind, number>>({ orders: 0, carts: 0, reviews: 0, contact: 0 });

const setCounts = (patch: Partial<Record<Kind, number>>): void => {
  counts.update((current) => ({ ...current, ...patch }));
};

/** Mirrors the routing of NavCountsService: route -> (count, plural base). */
function badge(kind: Kind): NavBadge {
  const labelKey = {
    orders: 'orders.countPending',
    carts: 'carts.countAbandoned',
    reviews: 'reviews.countPending',
    contact: 'contactMessages.countUnread',
  }[kind];
  return { count: counts()[kind], labelKey };
}

const navCountsStub = {
  badgeFor: (route: string): NavBadge | null => {
    const kind = (Object.keys(ROUTES) as Array<keyof typeof ROUTES>).find((key) =>
      route.includes(ROUTES[key].replace('/dashboard', '')),
    );
    return kind ? badge(kind) : null;
  },
};

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

const authStub = {
  hasPermission: () => true,
  isLoggedIn: () => false,
  currentUser: signal(null),
  getFullName: () => '',
};

describe('nav badges (accessible names)', () => {
  let fixture: ComponentFixture<AppSidebarComponent>;
  let root: HTMLElement;
  let language: LanguageService;
  let transloco: TranslocoService;

  /**
   * The named elements inside the nav link for `route` — the badge is the only
   * one, so a second one would mean something else borrowed its name.
   */
  const badgeEls = (route: string): HTMLElement[] => {
    const link = root.querySelector<HTMLAnchorElement>(`a[href="${route}"]`);
    expect(link, `link ${route}`).not.toBeNull();
    return Array.from(
      link!.querySelectorAll<HTMLElement>('[aria-label]:not([aria-hidden="true"])'),
    );
  };

  /** The aria-label of the badge inside the nav link for `route`, if any. */
  const badgeLabel = (route: string): string | null => {
    const els = badgeEls(route);
    expect(els.length, `named elements in ${route}`).toBeLessThanOrEqual(1);
    return els[0]?.getAttribute('aria-label') ?? null;
  };

  /** Simulate what LanguageService.applyLanguage() does after a switch. */
  const useLanguage = (lang: Language): void => {
    transloco.setActiveLang(lang);
    language.language.set(lang);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    counts.set({ orders: 0, carts: 0, reviews: 0, contact: 0 });
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

    transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(en, 'en');
    transloco.setTranslation(ar, 'ar');

    fixture = TestBed.createComponent(AppSidebarComponent);
    language = TestBed.inject(LanguageService);
    useLanguage('en');
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('announces each badge in English, each with its own wording', () => {
    setCounts({ orders: 3, carts: 2, reviews: 1, contact: 5 });
    fixture.detectChanges();

    expect(badgeLabel(ROUTES.orders)).toBe('3 pending orders');
    expect(badgeLabel(ROUTES.carts)).toBe('2 abandoned carts');
    // The reviews and contact families already existed (`{{count}} pending`,
    // `{{count}} unread`) and are reused rather than duplicated.
    expect(badgeLabel(ROUTES.reviews)).toBe('1 pending');
    expect(badgeLabel(ROUTES.contact)).toBe('5 unread');
  });

  it('announces the same badges in Arabic, and never falls back to English', () => {
    setCounts({ orders: 3, carts: 2, reviews: 1, contact: 5 });
    useLanguage('ar');

    expect(badgeLabel(ROUTES.orders)).toBe('3 طلبات قيد الانتظار');
    expect(badgeLabel(ROUTES.carts)).toBe('سلتان مهجورتان');
    expect(badgeLabel(ROUTES.reviews)).toBe('قيد المراجعة واحد');
    expect(badgeLabel(ROUTES.contact)).toBe('5 غير مقروءة');

    for (const route of Object.values(ROUTES)) {
      expect(badgeLabel(route)).not.toMatch(/pending|abandoned|unread/i);
    }
  });

  it('uses the Arabic plural category of the count, not one fixed word', () => {
    setCounts({ orders: 1 });
    useLanguage('ar');
    expect(badgeLabel(ROUTES.orders)).toBe('طلب واحد قيد الانتظار');

    setCounts({ orders: 2 });
    fixture.detectChanges();
    expect(badgeLabel(ROUTES.orders)).toBe('طلبان قيد الانتظار');

    // 3–10 is `few`: the counted noun is plural.
    setCounts({ orders: 3 });
    fixture.detectChanges();
    expect(badgeLabel(ROUTES.orders)).toBe('3 طلبات قيد الانتظار');

    // 11–99 is `many`: the counted noun is SINGULAR — this is the form the
    // hardcoded "{{n}} pending" could never produce.
    setCounts({ orders: 11 });
    fixture.detectChanges();
    expect(badgeLabel(ROUTES.orders)).toBe('11 طلبًا قيد الانتظار');

    // 100+ is `other`.
    setCounts({ orders: 100 });
    fixture.detectChanges();
    expect(badgeLabel(ROUTES.orders)).toBe('100 طلب قيد الانتظار');

    setCounts({ contact: 1, carts: 2 });
    fixture.detectChanges();
    expect(badgeLabel(ROUTES.contact)).toBe('غير مقروءة واحدة');
    expect(badgeLabel(ROUTES.carts)).toBe('سلتان مهجورتان');
  });

  it('follows a runtime language switch on the same instance', () => {
    setCounts({ orders: 4, contact: 9 });
    fixture.detectChanges();

    const english = [badgeLabel(ROUTES.orders), badgeLabel(ROUTES.contact)];

    useLanguage('ar');
    const arabic = [badgeLabel(ROUTES.orders), badgeLabel(ROUTES.contact)];
    expect(arabic[0]).not.toBe(english[0]);
    expect(arabic[0]).toBe('4 طلبات قيد الانتظار');
    expect(arabic[1]).toBe('9 غير مقروءة');

    // …and back, without rebuilding the component.
    useLanguage('en');
    expect([badgeLabel(ROUTES.orders), badgeLabel(ROUTES.contact)]).toEqual(english);
  });

  it('keeps the same name on the rail dot, and no number beside it', () => {
    setCounts({ orders: 6 });
    fixture.detectChanges();
    expect(badgeLabel(ROUTES.orders)).toBe('6 pending orders');

    TestBed.inject(HlmSidebarService).setOpen(false);
    fixture.detectChanges();

    const dot = badgeEls(ROUTES.orders)[0];
    expect(dot).toBeTruthy();
    // The collapsed rail has no room for a number: a dot, named the same way.
    expect(dot.textContent?.trim()).toBe('');
    expect(dot.classList).toContain('rounded-full');
    expect(dot.getAttribute('aria-label')).toBe('6 pending orders');

    useLanguage('ar');
    expect(dot.getAttribute('aria-label')).toBe('6 طلبات قيد الانتظار');
  });

  it('renders no badge (and no name) for a zero count', () => {
    setCounts({ orders: 0, carts: 3 });
    fixture.detectChanges();

    // 0 is a real answer, and it is not a badge.
    expect(badgeEls(ROUTES.orders)).toHaveLength(0);
    expect(badgeLabel(ROUTES.carts)).toBe('3 abandoned carts');
  });
});
