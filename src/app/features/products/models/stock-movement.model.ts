/**
 * The inventory movement log (FE-13).
 *
 * A row per stock change, written by the backend in the same transaction as the
 * change: what the count was, what it became, who did it and why. The panel shows
 * the numbers the change actually saw — not the current stock, which would make
 * every old row describe today.
 */

/** Why a stock number changed — the machine-readable source of the row. */
export type StockMovementReason =
  | 'ORDER'
  | 'MANUAL_ADJUSTMENT'
  | 'PRODUCT_EDIT'
  | 'RETURN'
  | 'ORDER_CANCELLED';

/** Where the change came from; `sourceId` points at that entity. */
export type StockMovementSource = 'ORDER' | 'MANUAL' | 'PRODUCT' | 'RETURN';

export interface StockMovement {
  id: number;
  variantId: number;
  /** `stockAfter - stockBefore`: negative when units left the shelf. */
  delta: number;
  stockBefore: number;
  stockAfter: number;
  reason: StockMovementReason;
  /** The admin's sentence on a manual adjustment; null for the other rows. */
  reasonNote: string | null;
  /** Who did it: an admin's e-mail, a customer's, or a system worker. */
  actor: string;
  sourceType: StockMovementSource;
  sourceId: number | null;
  createdAt: string;
}
