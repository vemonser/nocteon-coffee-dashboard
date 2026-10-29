import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { NavCountsService } from './nav-counts.service';

const URL = `${environment.apiUrl}/api/dashboard/nav-counts`;

const locales = import.meta.glob('/public/assets/i18n/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Dict>;

type Dict = Record<string, unknown>;

function flatten(dict: Dict, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [key, value] of Object.entries(dict)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of flatten(value as Dict, path)) out.add(nested);
    } else {
      out.add(path);
    }
  }
  return out;
}

const enKeys = flatten(locales['/public/assets/i18n/en.json']);
const arKeys = flatten(locales['/public/assets/i18n/ar.json']);

describe('NavCountsService', () => {
  let service: NavCountsService;
  let http: HttpTestingController;
  let loggedIn: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    loggedIn = signal(false);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => loggedIn(),
            hasPermission: () => loggedIn(),
          },
        },
      ],
    });
    service = TestBed.inject(NavCountsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('does not poll before a session exists', () => {
    // Booted on the login screen, this used to fetch and then 401 every
    // minute for the life of the tab.
    http.expectNone(URL);
  });

  it('fetches once the session exists and clears on logout', () => {
    loggedIn.set(true);
    TestBed.tick();

    http.expectOne(URL).flush({ data: { openOrders: 4, abandonedCarts: 2 } });
    expect(service.counts()?.orders).toBe(4);
    expect(service.badgeFor('/dashboard/orders')).toEqual({
      count: 4,
      labelKey: 'orders.countPending',
    });
    expect(service.badgeFor('/dashboard/carts')).toEqual({
      count: 2,
      labelKey: 'carts.countAbandoned',
    });

    loggedIn.set(false);
    TestBed.tick();

    expect(service.counts()).toBeNull();
    expect(service.badgeFor('/dashboard/orders')).toBeNull();
    http.expectNone(URL);
  });

  it('reads the keys the endpoint returns and leaves a forbidden area without a badge', () => {
    loggedIn.set(true);
    TestBed.tick();

    http.expectOne(URL).flush({
      data: {
        openOrders: 7,
        abandonedCarts: 3,
        pendingReviews: 5,
        contactUnread: 2,
        unreadMessages: 2,
      },
    });

    expect(service.badgeFor('/dashboard/orders')?.count).toBe(7);
    expect(service.badgeFor('/dashboard/carts')?.count).toBe(3);
    expect(service.badgeFor('/dashboard/reviews')?.count).toBe(5);
    expect(service.badgeFor('/dashboard/contact-messages')?.count).toBe(2);
  });

  it('names each badge with its own plural family, present in both locales', () => {
    // The badge's accessible name is a KEY here and a translated sentence in
    // the template. `ariaLabel()` returned `${n} pending` for three of the four
    // routes, so an Arabic UI announced an English sentence — and the string
    // was not in a locale file at all. A sentence fails this test; a key that
    // is missing (or an incomplete family) fails it too.
    loggedIn.set(true);
    TestBed.tick();
    http.expectOne(URL).flush({
      data: { openOrders: 7, abandonedCarts: 3, pendingReviews: 5, contactUnread: 2 },
    });

    const badges = {
      orders: service.badgeFor('/dashboard/orders'),
      carts: service.badgeFor('/dashboard/carts'),
      reviews: service.badgeFor('/dashboard/reviews'),
      contact: service.badgeFor('/dashboard/contact-messages'),
    };

    expect(badges.orders?.labelKey).toBe('orders.countPending');
    expect(badges.carts?.labelKey).toBe('carts.countAbandoned');
    expect(badges.reviews?.labelKey).toBe('reviews.countPending');
    expect(badges.contact?.labelKey).toBe('contactMessages.countUnread');

    // Four badges, four wordings: carts never say "pending".
    expect(new Set(Object.values(badges).map((b) => b?.labelKey)).size).toBe(4);

    for (const badge of Object.values(badges)) {
      const base = badge!.labelKey;
      expect(base, 'a key, not a sentence').toMatch(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/);
      for (const suffix of ['one', 'other'])
        expect(enKeys.has(`${base}_${suffix}`), `en ${base}_${suffix}`).toBe(true);
      for (const suffix of ['zero', 'one', 'two', 'few', 'many', 'other']) {
        expect(arKeys.has(`${base}_${suffix}`), `ar ${base}_${suffix}`).toBe(true);
      }
    }
  });

  it('has no route whose badge falls back to one shared label', () => {
    // Belt and braces for the same defect: the label must depend on the route.
    loggedIn.set(true);
    TestBed.tick();
    http.expectOne(URL).flush({
      data: { openOrders: 1, abandonedCarts: 1, pendingReviews: 1, contactUnread: 1 },
    });

    const keys = [
      '/dashboard/orders',
      '/dashboard/carts',
      '/dashboard/reviews',
      '/dashboard/contact-messages',
    ].map((route) => service.badgeFor(route)?.labelKey);
    expect(keys.every((key) => typeof key === 'string')).toBe(true);
    expect(keys).not.toContain(undefined);
    expect(new Set(keys.filter((key) => key?.endsWith('countPending'))).size).toBe(2);
  });

  it('renders a zero count as no badge instead of inventing one', () => {
    loggedIn.set(true);
    TestBed.tick();

    http.expectOne(URL).flush({ data: { openOrders: 0 } });

    // 0 is a real answer; the sidebar hides a zero badge and the other areas
    // have no key at all for this role.
    expect(service.badgeFor('/dashboard/orders')?.count).toBe(0);
    expect(service.badgeFor('/dashboard/carts')).toBeNull();
  });

  it('keeps the last good counts when a poll fails and logs the failure once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loggedIn.set(true);
    TestBed.tick();
    http.expectOne(URL).flush({ data: { openOrders: 4 } });

    service.fetch();
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(service.counts()?.orders).toBe(4);
    expect(service.badgeFor('/dashboard/orders')?.count).toBe(4);

    service.fetch();
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(service.counts()?.orders).toBe(4);
  });

  it('ignores fetch() when logged out', () => {
    service.fetch();
    http.expectNone(URL);
  });
});
