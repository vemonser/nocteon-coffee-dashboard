import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Dashboard entry gate: the session must belong to an ADMIN.
 *
 * The login/refresh response carries `user.role`, and the app initializer
 * refreshes the session before routing, so the role is available client-side
 * by the time this guard runs. This covers deep links / reloads; the login
 * component also checks the role at submit time and shows the explanatory
 * message there.
 *
 * Security boundary — do not over-claim this. The backend authenticates any
 * valid account, so `/api/dashboard/*` remains reachable by an authenticated
 * non-admin who calls the API directly. Real authorization must be enforced
 * server-side; this guard is defence-in-depth and correct UX, not the boundary.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  if (auth.currentUser()?.role !== 'ADMIN') {
    return router.createUrlTree(['/login']);
  }

  return true;
};
