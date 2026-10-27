/**
 * Who may enter the dashboard shell at all.
 *
 * Two roles share the shell but not its contents:
 *   ADMIN     — every page (the backend still checks each permission).
 *   MODERATOR — the pages their permissions unlock; the nav and the route
 *               guards hide the rest.
 *
 * Everyone else is a storefront account: the backend authenticates them, but
 * every /api/dashboard/** permission is missing, so the UI must not pretend
 * they have a dashboard.
 *
 * This is UX, not the security boundary: the API authorises each endpoint by
 * permission, so a role that slips through here still gets 403s.
 */
export const DASHBOARD_ROLES = ['ADMIN', 'MODERATOR'] as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export function canEnterDashboard(user: { role?: string | null } | null | undefined): boolean {
  const role = user?.role;
  return !!role && (DASHBOARD_ROLES as readonly string[]).includes(role);
}
