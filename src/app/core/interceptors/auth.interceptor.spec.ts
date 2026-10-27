import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { NotifyService } from '../notify/notify.service';
import { authInterceptor } from './auth.interceptor';

function fakeJwt(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

const USER = {
  id: 1,
  email: 'admin@example.com',
  username: 'admin',
  role: 'ADMIN',
  firstName: 'Admin',
  lastName: 'User',
  avatarUrl: '',
  permissions: [],
};

const URL_UNDER_TEST = `${environment.apiUrl}/api/dashboard/nav-counts`;

describe('authInterceptor', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: NotifyService,
          useValue: { apiError: vi.fn(), success: vi.fn(), backendMessage: () => null },
        },
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    service.setSession(fakeJwt(), USER);
  });

  afterEach(() => {
    service.clearSession();
    http.verify();
    vi.restoreAllMocks();
  });

  it('keeps the session when the retried request still answers 401', () => {
    let status: number | undefined;

    service['http'].get(URL_UNDER_TEST).subscribe({ error: (err) => (status = err.status) });

    http.expectOne(URL_UNDER_TEST).flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresh = http.expectOne(`${environment.apiUrl}/api/auth/refresh`);
    refresh.flush({
      data: { accessToken: fakeJwt(), expiresIn: 900, user: USER },
    });

    http.expectOne(URL_UNDER_TEST).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    // A 401 from one widget is not proof the session is dead. Clearing here
    // logged admins out mid-session (e.g. when nav counts failed).
    expect(service.isLoggedIn()).toBe(true);
  });

  it('ends the session when the refresh itself fails', () => {
    let failed = false;

    service['http'].get(URL_UNDER_TEST).subscribe({ error: () => (failed = true) });

    http.expectOne(URL_UNDER_TEST).flush({}, { status: 401, statusText: 'Unauthorized' });

    http
      .expectOne(`${environment.apiUrl}/api/auth/refresh`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(service.isLoggedIn()).toBe(false);
  });

  it('refreshes once for concurrent 401s and retries each request', () => {
    service['http'].get(`${URL_UNDER_TEST}/a`).subscribe({ error: () => undefined });
    service['http'].get(`${URL_UNDER_TEST}/b`).subscribe({ error: () => undefined });

    http.expectOne(`${URL_UNDER_TEST}/a`).flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${URL_UNDER_TEST}/b`).flush({}, { status: 401, statusText: 'Unauthorized' });

    const refreshes = http.match(`${environment.apiUrl}/api/auth/refresh`);
    expect(refreshes.length).toBe(1);
    refreshes[0].flush({
      data: { accessToken: fakeJwt(), expiresIn: 900, user: USER },
    });

    http.expectOne(`${URL_UNDER_TEST}/a`).flush({ success: true, data: {} });
    http.expectOne(`${URL_UNDER_TEST}/b`).flush({ success: true, data: {} });
    expect(service.isLoggedIn()).toBe(true);
  });
});
