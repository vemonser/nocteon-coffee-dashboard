# Decisions — permissions-ui-1 (C tasks)

## C1/C2 — Permission slug verification

The task table's permission slugs were checked against the source of truth the
Roles page uses (`ALL_PERMISSIONS` in
`src/app/shared/utils/permission.utils.ts`) and the live `GET /api/dashboard/roles`
response (same slug sets returned to the UI).

| Slug | Real? | Notes |
|---|---|---|
| dashboard:read | yes | |
| order:read / order:update | yes | |
| cart:read_all / cart:manage / cart:notify | yes | |
| review:read / review:moderate / review:delete | yes | |
| product:read / product:create / product:update / product:delete | yes | |
| user:read / user:create / user:update / user:delete / user:change_role | yes | |
| contact:read / contact:update | yes | |
| notification:read / notification:update / notification:delete | yes | |
| settings:read / settings:update | yes | |
| audit:read | yes | route/page not implemented yet in the frontend — guard added where the page lands. |
| promo:read / promo:update / promo:create / promo:delete | yes | |
| shipping:read / shipping:update / shipping:moderate | yes | |
| journal:read / journal:create / journal:update / journal:delete | yes | |
| broadcast:read / broadcast:create / broadcast:delete | yes | |
| catalog references (category, origin, farm, roast_level, coffee_variety, processing_method, brewing_method, pairing, tasting_note) each with :read/:create/:update/:delete | yes | all present in ALL_PERMISSIONS. |

**No slug in the task table was missing.** No substitutions were needed; where a
task named a slug the UI did not previously reference, that slug was adopted as
written (e.g. `cart:read_all` for the Carts page, `review:read` for the Reviews
page, `settings:read` for Store settings).

## Helpers

- `PermissionService.has(slug)` (via `AuthService`) is the single runtime source.
- `appCan` (`CanDirective`) and the new `appCanDisable` (`CanDisableDirective`,
  added here because it did not exist yet) are the template helpers backed by
  `PermissionService.has`. No new permission mechanism was invented; the pre-existing
  `*hasPermission` structural directive remains but new work uses `appCan`/`appCanDisable`.

## Behaviour decisions

- The 403 page reads the denied slug from the URL (`/unauthorized?permission=<slug>&from=<url>`)
  and renders title "You don't have access", the muted slug, and a "back to first
  allowed page" action.
- Post-login redirect: the login component now routes to the first page the signed-in
  user may actually open (computed from the route→permission map), instead of hard
  coding `/dashboard`.
- The dashboard entry guard (`authGuard`) currently accepts ADMIN only; it is
  defence-in-depth and must be relaxed to the permission set in a follow-up so a
  permitted non-admin reaches the dashboard (C1 follow-up, noted here).
