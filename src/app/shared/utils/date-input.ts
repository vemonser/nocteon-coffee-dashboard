/**
 * An ISO instant as the value of a `datetime-local` input.
 *
 * <p>The input speaks LOCAL time (`YYYY-MM-DDTHH:mm`), so the ISO instant is
 * converted into the browser's own zone — the store's zone. An instant that
 * cannot be parsed becomes an empty field rather than an invalid one.
 *
 * <p>Without this conversion, slicing the ISO string (`.substring(0, 16)`)
 * treats a UTC instant as local wall-clock time: every open-and-save shifts the
 * value by the UTC offset, which can move a scheduled post across "now".
 */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
