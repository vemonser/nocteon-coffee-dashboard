/**
 * The file name in a `Content-Disposition` header, when there is one.
 *
 * `/api/dashboard/orders/{id}/invoice` answers the PDF as an attachment named
 * after the order. The browser downloads whatever name the `download` attribute
 * says, so the page prefers the SERVER's name — the backend is the one that
 * knows the order number and can change the convention without the client
 * following.
 *
 * Two shapes exist in the wild and both are handled:
 *   - `attachment; filename="invoice-ORD-2026-000042.pdf"` (plain ASCII)
 *   - `attachment; filename*=UTF-8''invoice-ORD…pdf` (RFC 5987, non-ASCII)
 *
 * CORS hides this header unless the API exposes it, and a proxy may strip it, so
 * `null` is a normal answer: the caller then builds `invoice-<orderNumber>.pdf`
 * itself. Guessing is only ever the fallback, never the rule.
 */
export function invoiceFilenameFrom(disposition: string | null | undefined): string | null {
  if (!disposition) return null;

  // filename* (RFC 5987) wins: it is the encoding-safe one when both are sent.
  const encoded = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(disposition);
  if (encoded && encoded[1]) {
    try {
      const decoded = decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''));
      if (decoded.length > 0) return decoded;
    } catch {
      // A malformed escape is not a reason to fail a download: fall through to
      // the plain form, then to the caller's own name.
    }
  }

  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
  if (plain && plain[1]) {
    const trimmed = plain[1].trim();
    if (trimmed.length > 0) return trimmed;
  }

  return null;
}
