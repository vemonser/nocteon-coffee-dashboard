import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { NavCountsService } from './nav-counts.service';

const URL = `${environment.apiUrl}/api/dashboard/nav-counts`;

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
    expect(service.badgeFor('/dashboard/orders')).toBe(4);
    expect(service.badgeFor('/dashboard/carts')).toBe(2);

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

    expect(service.badgeFor('/dashboard/orders')).toBe(7);
    expect(service.badgeFor('/dashboard/carts')).toBe(3);
    expect(service.badgeFor('/dashboard/reviews')).toBe(5);
    expect(service.badgeFor('/dashboard/contact-messages')).toBe(2);
  });

  it('renders a zero count as no badge instead of inventing one', () => {
    loggedIn.set(true);
    TestBed.tick();

    http.expectOne(URL).flush({ data: { openOrders: 0 } });

    // 0 is a real answer; the sidebar hides a zero badge and the other areas
    // have no key at all for this role.
    expect(service.badgeFor('/dashboard/orders')).toBe(0);
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
    expect(service.badgeFor('/dashboard/orders')).toBe(4);

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
