export type StockLevel = 'out' | 'low' | 'ok';

/**
 * THE shared low-stock rule. The dashboard's Low stock card is fed by the
 * backend's `lowStockProducts`, which uses the same boundary: low at or below
 * the reorder threshold, out at zero.
 */
export function stockLevel(
  stockQuantity: number | null | undefined,
  reorderThreshold: number | null | undefined,
): StockLevel {
  const stock = Number(stockQuantity ?? 0);
  if (!Number.isFinite(stock) || stock <= 0) return 'out';
  const threshold = reorderThreshold == null ? null : Number(reorderThreshold);
  if (threshold != null && Number.isFinite(threshold) && stock <= threshold) return 'low';
  return 'ok';
}
