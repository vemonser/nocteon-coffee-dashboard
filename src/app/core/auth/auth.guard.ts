import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { canEnterDashboard } from './dashboard-roles';

/**
 * Dashboard entry gate: ADMIN or MODERATOR (see `canEnterDashboard`).
 *
 * The login/refresh response carries `user.role`, and the app initializer
 * refreshes the session before routing, so the role is available client-side
 * by the time this guard runs. This covers deep links / reloads; the login
 * component also checks the role at submit time and shows the explanatory
 * message there.
 *
 * Security boundary — do not over-claim this. The backend authenticates any
 * valid account and authorises each dashboard endpoint by permission
 * (`dashboard:read`, `notification:read`, …), not by role: a CUSTOMER holds
 * none of them and gets 403. This guard only decides who sees the shell; what
 * they see inside it is `permissionGuard` and the sidebar filter, and the API
 * is the real authority either way.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login']);
  }

  if (!canEnterDashboard(auth.currentUser())) {
    return router.createUrlTree(['/login']);
  }

  return true;
};
