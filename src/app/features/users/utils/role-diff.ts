import { isSensitive } from '../../../shared/utils/permission.utils';

export interface RoleDiff {
  /** Permissions the new role has and the current one does not. */
  granted: string[];
  /** Permissions the current role has and the new one does not. */
  revoked: string[];
  /** The granted permissions that are sensitive — the ones that gate the type-to-confirm step. */
  sensitiveGranted: string[];
}

/**
 * Compare two effective permission sets.
 *
 * The dialog shows what CHANGES, not the whole matrix: moving to a role with
 * 90 permissions should read as "grants 70, revokes 3", not as a 90-row wall.
 */
export function diffPermissions(
  current: readonly string[] = [],
  next: readonly string[] = [],
): RoleDiff {
  const currentSet = new Set(current);
  const nextSet = new Set(next);

  const granted = next.filter((permission) => !currentSet.has(permission)).sort();
  const revoked = current.filter((permission) => !nextSet.has(permission)).sort();

  return {
    granted,
    revoked,
    sensitiveGranted: granted.filter((permission) => isSensitive(permission)),
  };
}
