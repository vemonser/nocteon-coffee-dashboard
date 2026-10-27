import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

function fakeJwt(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

/**
 * Logout must never leave a live session in memory, even when the server call
 * fails: the click is a promise to the user that this device is signed out.
 */
describe('AuthService logout lifecycle', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  const user = {
    id: 1,
    email: 'admin@example.com',
    username: 'admin',
    role: 'ADMIN',
    firstName: 'Admin',
    lastName: 'User',
    avatarUrl: null,
    permissions: [],
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    service.setSession(fakeJwt(), user as never);
    expect(service.isLoggedIn()).toBe(true);
  });

  afterEach(() => {
    service.clearSession();
    http.verify();
    vi.restoreAllMocks();
  });

  it('clears the session and returns to /login on success', () => {
    service.logout().subscribe();

    const req = http.expectOne(`${environment.apiUrl}/api/auth/logout`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush({ success: true });

    expect(service.isLoggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('clears the session and returns to /login even when the call fails', () => {
    service.logout().subscribe({ error: () => undefined });

    const req = http.expectOne(`${environment.apiUrl}/api/auth/logout`);
    req.flush({ success: false }, { status: 503, statusText: 'Service Unavailable' });

    expect(service.isLoggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
