import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

function fakeJwt(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

describe('AuthService OAuth2 exchange', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.clearSession();
    http.verify();
  });

  it('POSTs the one-time code with credentials and sets the session', () => {
    const token = fakeJwt();
    let role: string | undefined;

    service.exchangeOAuth2Code('code-123').subscribe((res) => {
      role = res.data.user.role;
    });

    const req = http.expectOne(`${environment.apiUrl}/api/auth/oauth2/exchange`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: 'code-123' });
    expect(req.request.withCredentials).toBe(true);

    req.flush({
      data: {
        accessToken: token,
        expiresIn: 900,
        user: { id: 1, role: 'ADMIN', permissions: [] },
      },
    });

    expect(service.accessToken()).toBe(token);
    expect(service.currentUser()?.role).toBe('ADMIN');
    expect(role).toBe('ADMIN');
  });
});
