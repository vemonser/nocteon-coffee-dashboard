import { describe, expect, it } from 'vitest';
import { canEnterDashboard } from './dashboard-roles';

describe('canEnterDashboard', () => {
  it('lets an admin in', () => {
    expect(canEnterDashboard({ role: 'ADMIN' })).toBe(true);
  });

  it('lets a moderator in: the shell is shared, the pages are not', () => {
    expect(canEnterDashboard({ role: 'MODERATOR' })).toBe(true);
  });

  it('keeps a storefront account out', () => {
    expect(canEnterDashboard({ role: 'CUSTOMER' })).toBe(false);
    expect(canEnterDashboard({ role: 'SALES' })).toBe(false);
  });

  it('keeps a missing session out', () => {
    expect(canEnterDashboard(null)).toBe(false);
    expect(canEnterDashboard(undefined)).toBe(false);
    expect(canEnterDashboard({})).toBe(false);
  });
});
