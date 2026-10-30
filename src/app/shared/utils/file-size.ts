/**
 * One file-size formatter for the whole dashboard (W7).
 *
 * <p>Before this, the media step printed "max 10 mB" while the error sentence
 * said "10 MB" and the variant hint said "5 MB" as static prose. A single
 * function means the unit is always upper case and always the same unit the
 * reader is thinking in: B, KB, MB, GB.
 *
 * <p>Binary units (1 KB = 1024 B) match the limits the server enforces, so a
 * file just under the 10 MB cap prints "10 MB" and not "9.5 MiB".
 */
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatFileSize(bytes: number | null | undefined): string {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 B';

  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }

  // Bytes are whole; larger units take one decimal only when it adds meaning
  // ("1.5 MB"), never a trailing ".0".
  const rounded = unit === 0 ? Math.round(size) : Math.round(size * 10) / 10;
  const printed = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${printed} ${UNITS[unit]}`;
}
