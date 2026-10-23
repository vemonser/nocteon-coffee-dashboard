import { describe, it, expect } from 'vitest';
import {
  parsePermission,
  groupPermissions,
  humanize,
  domainOf,
  actionLabel,
  isSensitive,
  isStandardAction,
} from './permission.utils';

describe('permission.utils', () => {
  it('parses permission', () => {
    expect(parsePermission('order:update')).toEqual({ resource: 'order', action: 'update' });
  });
  it('groups permissions by domain/resource', () => {
    const grouped = groupPermissions(['order:read', 'order:update', 'cart:read_all', 'unknown:foo']);
    expect(grouped['Sales']['order']).toEqual(['order:read', 'order:update']);
    expect(grouped['Sales']['cart']).toEqual(['cart:read_all']);
    expect(grouped['Other']['unknown']).toEqual(['unknown:foo']);
  });
  it('unknown resource goes to Other', () => {
    expect(domainOf('totally_new')).toBe('Other');
  });
  it('unknown action falls back to humanized label', () => {
    expect(actionLabel('order:ship_now')).toBe('Ship Now');
  });
  it('humanizes underscores', () => {
    expect(humanize('roast_level')).toBe('Roast Level');
  });
  it('marks sensitive', () => {
    expect(isSensitive('user:delete')).toBe(true);
    expect(isSensitive('order:read')).toBe(false);
  });
  it('standard actions', () => {
    expect(isStandardAction('read')).toBe(true);
    expect(isStandardAction('read_all')).toBe(false);
  });
});
