import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { PermissionService } from './permission.service';
import { AuthService } from './auth.service';

describe('PermissionService', () => {
  const createMockAuth = (perms: string[], role = 'USER') => {
    const mock = {
      currentUser: () => ({
        role,
        permissions: perms,
      }),
      accessToken: () => null,
      loading: () => false,
      isLoggedIn: () => true,
    };
    return mock;
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('returns true for ADMIN role regardless of permissions', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        PermissionService,
        { provide: AuthService, useValue: createMockAuth([], 'ADMIN') },
      ],
    });
    const svc = TestBed.inject(PermissionService);
    expect(svc.has('order:update')).toBe(true);
    expect(svc.has('user:delete')).toBe(true);
  });

  it('returns true when user has the permission', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        PermissionService,
        { provide: AuthService, useValue: createMockAuth(['order:read', 'product:read']) },
      ],
    });
    const svc = TestBed.inject(PermissionService);
    expect(svc.has('order:read')).toBe(true);
    expect(svc.has('product:read')).toBe(true);
  });

  it('returns false when user lacks the permission', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        PermissionService,
        { provide: AuthService, useValue: createMockAuth(['cart:read_all']) },
      ],
    });
    const svc = TestBed.inject(PermissionService);
    expect(svc.has('order:read')).toBe(false);
    expect(svc.has('contact:read')).toBe(false);
  });

  it('returns false for unknown slug when user is not ADMIN', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        PermissionService,
        { provide: AuthService, useValue: createMockAuth(['dashboard:read']) },
      ],
    });
    const svc = TestBed.inject(PermissionService);
    expect(svc.has('nonexistent:permission')).toBe(false);
  });

  it('hasSignal returns a computed signal', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        PermissionService,
        { provide: AuthService, useValue: createMockAuth(['order:read']) },
      ],
    });
    const svc = TestBed.inject(PermissionService);
    const signal = svc.hasSignal('order:read');
    expect(typeof signal).toBe('function');
  });
});