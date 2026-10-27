import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

function runGuard(loggedIn: boolean, permissions: string[]): boolean | UrlTree {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          isLoggedIn: () => loggedIn,
          hasPermission: (p: string) => permissions.includes(p),
        },
      },
    ],
  });

  return TestBed.runInInjectionContext(() => authGuard({} as never, {} as never)) as
    | boolean
    | UrlTree;
}

describe('authGuard', () => {
  it('sends a logged-out visitor to /login', () => {
    const result = runGuard(false, []);
    expect(result instanceof UrlTree).toBe(true);
    expect(String(result)).toBe('/login');
  });

  it('opens the shell for a role that holds dashboard:read', () => {
    expect(runGuard(true, ['dashboard:read'])).toBe(true);
  });

  it('is permission-based, not role-based', () => {
    // Nothing here says "ADMIN": any principal with the permission gets in.
    expect(runGuard(true, ['order:read', 'dashboard:read'])).toBe(true);
  });

  it('sends an authenticated principal without the permission to /unauthorized', () => {
    const result = runGuard(true, ['order:read']) as UrlTree;
    expect(result instanceof UrlTree).toBe(true);
    expect(String(result)).toBe('/unauthorized?permission=dashboard:read');
  });
});
