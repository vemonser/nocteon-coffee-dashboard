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
 * valid account and authorises each dashboard endpoint by permission
 * (`dashboard:read`, `notification:read`, …), not by role: a CUSTOMER holds
 * none of them and gets 403, but a MODERATOR does hold `dashboard:read`.
 * This guard is therefore STRICTER than the API (ADMIN only), and it is the
 * only thing keeping a moderator out of the UI. Decide that product rule
 * deliberately; the API will not enforce it for you.
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
