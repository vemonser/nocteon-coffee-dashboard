import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

describe('AuthService change password', () => {
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

  it('sends the backend contract: oldPassword, newPassword, confirmPassword', () => {
    service
      .changePassword({
        oldPassword: 'old-password-123',
        newPassword: 'new-password-456',
        confirmPassword: 'new-password-456',
      })
      .subscribe();

    const req = http.expectOne(`${environment.apiUrl}/api/users/me/password`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      oldPassword: 'old-password-123',
      newPassword: 'new-password-456',
      confirmPassword: 'new-password-456',
    });
    req.flush({ success: true });
  });
});
