import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from './language.service';

/**
 * THE shared helper for a localized entity name.
 *
 * Every widget that shows an entity name (order status, payment method,
 * device type, category, origin, roast level) goes through here, so a name
 * is never rendered from a raw enum and never leaks a raw translation key.
 *
 * Two rules it enforces:
 *
 * 1. **Never a raw key.** `TranslocoService.translate()` returns THE KEY
 *    ITSELF when a key is missing (Transloco's default missing-key handler).
 *    The dashboard showed literal `orders.statuses.DELIVERED` because the
 *    code did `translate(key) || fallback` — a missing key is a non-empty
 *    string, so `||` never fired. This helper compares the result with the
 *    key it asked for and substitutes the fallback when they are identical.
 *
 * 2. **Never a raw enum.** If there is no translation at all, the raw
 *    `DELIVERED` is humanised to `Delivered` rather than shown in caps.
 */
@Injectable({ providedIn: 'root' })
export class LocalizedNameService {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);

  /**
   * Translate `key`, falling back to `fallback` when the key is missing.
   * A missing key is detected by transloco returning the key unchanged.
   */
  translate(key: string, fallback: string): string {
    const value = this.transloco.translate(key);
    // Transloco returns the key itself for a missing translation.
    if (!value || value === key) return fallback;
    return value;
  }

  /**
   * The localized name of an enum-like value.
   *
   * @param namespace the i18n namespace, e.g. `orders.statuses`
   * @param value     the raw value from the API, e.g. `DELIVERED`
   */
  enumName(namespace: string, value: string): string {
    return this.translate(`${namespace}.${value}`, humanize(value));
  }

  /** Order status, e.g. DELIVERED -> "Delivered" / "تم التوصيل". */
  orderStatus(status: string): string {
    return this.enumName('orders.statuses', status);
  }

  /** Payment method, e.g. CASH_ON_DELIVERY -> "Cash on delivery". */
  paymentMethod(method: string): string {
    return this.enumName('dashboard.paymentMethods', method);
  }

  /** Device type, e.g. MAC -> "Mac". */
  deviceType(device: string): string {
    return this.enumName('dashboard.deviceTypes', device);
  }

  /** The current UI language. */
  get lang(): 'en' | 'ar' {
    return this.language.current();
  }
}

/**
 * `CASH_ON_DELIVERY` -> `Cash on delivery`, `IOS` -> `Ios`.
 *
 * Used only as the last resort when a value has no translation at all; it
 * keeps a raw enum from reaching the screen in capitals.
 */
export function humanize(value: string): string {
  if (!value) return '';
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
