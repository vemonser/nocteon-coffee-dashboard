/**
 * One row of the audit trail, as the API returns it.
 *
 * <p>`oldValues`, `newValues` and `metadata` are the STORED JSON TEXT, not an
 * object: the backend hands over what was recorded, byte for byte. The page
 * pretty-prints them for reading and copies the same text, so a value with
 * odd spacing or an unusual number spelling survives the round trip.
 *
 * <p>Only the columns `public.audit_logs` has. There is no username column, so
 * the actor is the recorded `userId` plus `userEmail`.
 */
export interface AuditLogEntry {
  id: number;
  userId: number | null;
  userEmail: string | null;
  /** The recorded action, e.g. `PRODUCT_UPDATE`. */
  action: string;
  entityType: string | null;
  entityId: number | null;
  entitySlug: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  oldValues: string | null;
  newValues: string | null;
  metadata: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

/** The query the audit list sends. Unset filters are left out entirely. */
export interface AuditLogQuery {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  /** Contains match on the action name. */
  action?: string;
  /** A user id, or a fragment of the actor's email. */
  actor?: string;
  /** ISO instant, inclusive. */
  since?: string;
  /** ISO instant, inclusive. */
  until?: string;
}

/** The three JSON columns, in the order the drawer shows them. */
export const AUDIT_DETAIL_FIELDS = ['oldValues', 'newValues', 'metadata'] as const;

export type AuditDetailField = (typeof AUDIT_DETAIL_FIELDS)[number];

/** The i18n key of each detail block's heading. */
export const AUDIT_DETAIL_LABEL: Record<AuditDetailField, string> = {
  oldValues: 'audit.detail.oldValues',
  newValues: 'audit.detail.newValues',
  metadata: 'audit.detail.metadata',
};
