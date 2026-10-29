import { describe, expect, it } from 'vitest';
import { invoiceFilenameFrom } from './invoice-filename';

describe('invoiceFilenameFrom', () => {
  it('reads the plain filename an attachment carries', () => {
    expect(
      invoiceFilenameFrom('attachment; filename="invoice-ORD-2026-000042.pdf"'),
    ).toBe('invoice-ORD-2026-000042.pdf');
  });

  it('reads an unquoted filename', () => {
    expect(invoiceFilenameFrom('attachment; filename=invoice-ORD-2026-000042.pdf')).toBe(
      'invoice-ORD-2026-000042.pdf',
    );
  });

  it('prefers the RFC 5987 form when both are present', () => {
    expect(
      invoiceFilenameFrom(
        "attachment; filename=\"invoice.pdf\"; filename*=UTF-8''invoice-%D9%A1.pdf",
      ),
    ).toBe('invoice-١.pdf');
  });

  it('answers null when the header is missing — CORS hides it, so the caller names the file', () => {
    expect(invoiceFilenameFrom(null)).toBeNull();
    expect(invoiceFilenameFrom(undefined)).toBeNull();
    expect(invoiceFilenameFrom('')).toBeNull();
    expect(invoiceFilenameFrom('attachment')).toBeNull();
  });

  it('falls back to the plain form when the encoded one is malformed', () => {
    expect(
      invoiceFilenameFrom(
        "attachment; filename=\"invoice-ORD-1.pdf\"; filename*=UTF-8''invoice-%E0%A4%A.pdf",
      ),
    ).toBe('invoice-ORD-1.pdf');
  });
});
