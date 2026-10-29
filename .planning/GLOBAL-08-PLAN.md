# GLOBAL-08: Permission-aware UI rollout

## Scope
Gate create/edit/delete actions and row-menu items across all list pages using
existing permission strings; add permissionGuard to routes missing it; verify
403 page reachable.

## Approach
- BaseListComponent: inject PermissionService, add createPermission/updatePermission/
  deletePermission fields and canCreate/canUpdate/canDelete computeds.
- All base-list subclasses set the three slugs.
- Templates: bind [showEdit]/[showDelete]/[showRestore]/[showPermanentDelete] to canUpdate()/canDelete().
- Custom pages: gate create buttons and bulk/row actions with *hasPermission.
- Routes: add permissionGuard to /dashboard/users/:id.
- Evidence: counts before/after, build, i18n check, screenshots.

## Baseline counts
- *hasPermission: 34
- appCan: 12
