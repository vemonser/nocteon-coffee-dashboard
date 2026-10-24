import { describe, expect, it } from 'vitest';

import { diffPermissions } from './role-diff';

describe('role change diff', () => {
  it('reports grants and revokes relative to the current role', () => {
    const diff = diffPermissions(
      ['order:read', 'product:read', 'review:read'],
      ['order:read', 'product:read', 'user:read'],
    );

    expect(diff.granted).toEqual(['user:read']);
    expect(diff.revoked).toEqual(['review:read']);
  });

  it('ignores permissions both roles share', () => {
    const diff = diffPermissions(['order:read'], ['order:read']);

    expect(diff.granted).toEqual([]);
    expect(diff.revoked).toEqual([]);
    expect(diff.sensitiveGranted).toEqual([]);
  });

  it('flags only GRANTED sensitive permissions', () => {
    const diff = diffPermissions(
      ['user:change_role'],
      ['user:change_role', 'settings:update', 'ai:manage'],
    );

    expect(diff.granted).toEqual(['ai:manage', 'settings:update']);
    expect(diff.sensitiveGranted).toEqual(['ai:manage', 'settings:update']);
  });

  it('does not flag a sensitive permission that is being revoked', () => {
    const diff = diffPermissions(['settings:update'], ['order:read']);

    expect(diff.revoked).toEqual(['settings:update']);
    expect(diff.sensitiveGranted).toEqual([]);
  });
});
