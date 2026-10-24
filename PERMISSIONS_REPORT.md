# Permissions & Roles — Inspection Report (P0)

## 1. Storage model
- Roles are stored as a Java enum: `com.nocteon.nocteon_api.auth.enums.Role` (`ADMIN`, `MODERATOR`, `CUSTOMER`). File: `nocteon-backend/.../auth/enums/Role.java`.
- Permissions are stored as a Java enum: `com.nocteon.nocteon_api.common.enums.Permission`, each exposing a string `"resource:action"` (e.g. `order:update`, `cart:read_all`). File: `nocteon-backend/.../common/enums/Permission.java`.
- Role → permission mapping is code, not a join table: `Role` constructor receives a `Set<Permission>`. `ADMIN = Permission.values()`; `MODERATOR` and `CUSTOMER` are hand-listed subsets. There is no DB table for roles or permissions.
- `User` entity has a single `Role role` column (`nocteon-backend/.../auth/entity/User.java`). No per-user permission table.

## 2. Per-user extras / authorities
- No per-user extra permissions exist. Effective permissions = role permissions only.
- Permissions are NOT in the JWT: `JwtService.generateAccessToken` stores only `role`. File: `nocteon-backend/.../auth/security/JwtService.java`.
- Permissions are loaded per request as part of `UserResponse.permissions` (from `Role.getPermissions()`). Frontend stores them on `AuthService.currentUser` via login/refresh. File: `nocteon-backend/.../auth/service/AuthService.java`.

## 3. Existing endpoints
- `GET /api/auth/login` → `ApiResponse<AuthResponse>` with `AuthResponse.user.permissions: string[]` and `role`.
- `POST /api/auth/refresh` → same `AuthResponse`.
- `GET /api/dashboard/users?role=&enabled=&isActive=&search=&page=&size=&sort=&direction=` → `ApiResponse<PageResponse<UserResponse>>`, each `UserResponse.permissions: string[]`.
- `GET /api/dashboard/users/{id}` → `ApiResponse<UserResponse>` with effective permissions.
- `POST /api/dashboard/users` (admin create) → `ApiResponse<UserResponse>`.
- `PUT /api/dashboard/users/{id}` (admin update, includes `role` when caller has `user:change_role`) → `ApiResponse<UserResponse>`.
- `PATCH /api/dashboard/users/{id}/toggle-active` → `ApiResponse<UserResponse>`.
- `DELETE /api/dashboard/users/{id}` → `ApiResponse<Void>` (added locally in the running jar; not in original source).
- `GET /api/dashboard/users/roles` → `ApiResponse<string[]>` (added locally in the running jar; not in original source).

No endpoints exist for: listing permissions, listing roles with metadata, getting/updating a role's permissions, creating/deleting roles, changing a user's role as a dedicated action, or per-user extras.

## 4. Server-side rules
- Role change is gated on `user:change_role` (checked inside `UserService.adminUpdate`). File: `nocteon-backend/.../auth/service/UserService.java`.
- No check prevents changing your own role (backend does not compare actor id to target id).
- No check prevents removing the last admin.
- `ADMIN` is not immutable: any caller with `user:change_role` can set a user's role to/from `ADMIN`. (Only `ADMIN` itself holds `user:change_role`, but the rule is permission-based, not role-immutable.)
- Admin role holds every permission (`Permission.values()`).

## Needs backend (to be added later)
1. `GET /api/dashboard/permissions` → `ApiResponse<string[]>` (all permission slugs), permission `user:read` (or new `permission:read`).
2. `GET /api/dashboard/roles` → `ApiResponse<Array<{name, description, system, usersCount, permissions: string[]}>>`, permission `user:read`.
3. `POST /api/dashboard/roles` body `{ name, description, permissions: string[] }` → `ApiResponse<RoleResponse>`, permission `user:change_role` (or `role:create`). Errors: 409 duplicate name, 400 invalid permission.
4. `PUT /api/dashboard/roles/{name}` body `{ description, permissions }` → `ApiResponse<RoleResponse>`, permission `user:change_role`. `ADMIN` must be locked server-side.
5. `DELETE /api/dashboard/roles/{name}` → `ApiResponse<Void>`, permission `user:change_role`. Errors: 409 if users still assigned or system role.
6. `PATCH /api/dashboard/users/{id}/role` body `{ role }` → `ApiResponse<UserResponse>`, permission `user:change_role`. Errors: 403 self-change, 409 last admin, 400 invalid role.
7. Per-user extras (optional): `GET /api/dashboard/users/{id}/permissions`, `PUT /api/dashboard/users/{id}/permissions` body `{ granted: string[] }`.

Frontend in this task builds against the existing `UserResponse.permissions` and the user's role only. Role CRUD and dedicated role change are built in a disabled "Needs backend" state with tooltips; no fake data is used.
