import { RoleResponse } from '../model/user.model';

export type RoleChipKind = 'all' | 'role' | 'blocked' | 'unverified';

export interface RoleChip {
  kind: RoleChipKind;
  /** Role name for `role` chips; the filter value otherwise. */
  value: string;
  count: number;
}

export interface RoleChipTotals {
  total: number;
  blocked: number;
  unverified: number;
}

/**
 * The Users list's count chips.
 *
 * Roles are NOT hardcoded: every role the roles endpoint returns becomes a
 * chip, so a custom role appears the moment it exists. `All` is the server's
 * user total, and every role's `userCount` comes from the same endpoint —
 * which is what makes "the role chips sum to All" a meaningful invariant
 * (see the spec) rather than a coincidence of one page of rows.
 */
export function buildRoleChips(
  roles: Pick<RoleResponse, 'name' | 'userCount'>[],
  totals: RoleChipTotals,
): RoleChip[] {
  return [
    { kind: 'all', value: 'ALL', count: totals.total },
    ...roles.map((role): RoleChip => ({
      kind: 'role',
      value: role.name,
      count: role.userCount,
    })),
    { kind: 'blocked', value: 'BLOCKED', count: totals.blocked },
    { kind: 'unverified', value: 'UNVERIFIED', count: totals.unverified },
  ];
}

/** Sum of the per-role chips only — All/Blocked/Unverified are not roles. */
export function roleChipsSum(chips: RoleChip[]): number {
  return chips.filter((chip) => chip.kind === 'role').reduce((sum, chip) => sum + chip.count, 0);
}

/** True when the per-role chips account for every user in `All`. */
export function roleChipsSumToAll(chips: RoleChip[]): boolean {
  const all = chips.find((chip) => chip.kind === 'all');
  return !!all && roleChipsSum(chips) === all.count;
}

/**
 * The five-colour palette a role badge may use. The classes stay literal so
 * Tailwind sees them at build time; a role therefore gets a stable colour,
 * not a class name assembled at runtime.
 */
export const ROLE_TINTS = [
  'bg-chart-1/15 text-chart-1',
  'bg-chart-2/15 text-chart-2',
  'bg-chart-3/15 text-chart-3',
  'bg-chart-4/15 text-chart-4',
  'bg-chart-5/15 text-chart-5',
] as const;

export const ADMIN_TINT = 'bg-primary/10 text-primary';
export const MODERATOR_TINT = 'bg-chart-5/15 text-chart-5';
export const CUSTOMER_TINT = 'bg-muted text-muted-foreground';

/**
 * A deterministic palette index for a custom role name. The same name always
 * paints the same colour, on every page and after every reload.
 */
export function roleTintIndex(name: string): number {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return hash % ROLE_TINTS.length;
}

/** Shared badge chrome; the tint is appended. */
const ROLE_BADGE_BASE = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';

/** The badge classes for a role: the three system roles are fixed, the rest hash into the palette. */
export function roleBadgeClasses(role: string): string {
  if (role === 'ADMIN') return `${ROLE_BADGE_BASE} ${ADMIN_TINT}`;
  if (role === 'MODERATOR') return `${ROLE_BADGE_BASE} ${MODERATOR_TINT}`;
  if (role === 'CUSTOMER') return `${ROLE_BADGE_BASE} ${CUSTOMER_TINT}`;
  return `${ROLE_BADGE_BASE} ${ROLE_TINTS[roleTintIndex(role)]}`;
}

