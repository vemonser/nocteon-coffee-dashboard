import { describe, expect, it } from 'vitest';

import { buildRoleChips, roleChipsSum, roleChipsSumToAll } from './role-chips';

/**
 * A2: the count chips are generated from the roles endpoint, so the role
 * chips must add up to the "All" chip. If they do not, either the roles
 * endpoint and the users endpoint disagree or a role is missing from the
 * strip — both are bugs, and both used to be invisible because the chips
 * were hardcoded ADMIN/CUSTOMER.
 */
describe('role chips', () => {
  const roles = [
    { name: 'ADMIN', userCount: 1 },
    { name: 'MODERATOR', userCount: 1 },
    { name: 'CUSTOMER', userCount: 8 },
  ];
  const totals = { total: 10, blocked: 0, unverified: 0 };

  it('starts with All, ends with Blocked and Unverified, one chip per role', () => {
    const chips = buildRoleChips(roles, totals);

    expect(chips[0]).toEqual({ kind: 'all', value: 'ALL', count: 10 });
    expect(chips.slice(-2).map((chip) => chip.kind)).toEqual(['blocked', 'unverified']);
    expect(chips.filter((chip) => chip.kind === 'role').map((chip) => chip.value)).toEqual([
      'ADMIN',
      'MODERATOR',
      'CUSTOMER',
    ]);
  });

  it('role chips sum to All', () => {
    const chips = buildRoleChips(roles, totals);

    expect(roleChipsSum(chips)).toBe(10);
    expect(roleChipsSumToAll(chips)).toBe(true);
  });

  it('includes custom roles, not just the three system ones', () => {
    const withCustom = [...roles, { name: 'CONTENT_EDITOR', userCount: 2 }];
    const chips = buildRoleChips(withCustom, { ...totals, total: 12 });

    expect(chips.some((chip) => chip.value === 'CONTENT_EDITOR')).toBe(true);
    expect(roleChipsSumToAll(chips)).toBe(true);
  });

  it('reports a mismatch instead of hiding it', () => {
    const chips = buildRoleChips(roles, { ...totals, total: 11 });

    expect(roleChipsSum(chips)).toBe(10);
    expect(roleChipsSumToAll(chips)).toBe(false);
  });
});
