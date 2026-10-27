import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
    expect(service.available()).toBe(true);

    loggedIn.set(false);
    TestBed.tick();

    expect(service.counts()).toBeNull();
    expect(service.available()).toBe(false);
    http.expectNone(URL);
  });

  it('ignores fetch() when logged out', () => {
    service.fetch();
    http.expectNone(URL);
  });
});
