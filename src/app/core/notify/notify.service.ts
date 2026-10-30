import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';
import { LanguageService } from '../i18n/language.service';
import { countMessage } from '../i18n/plural';

/**
 * Single channel for user-facing feedback on API outcomes.
 *
 * Rules (no silent errors):
 * - every mutation shows a success toast or an error toast — never neither;
 * - backend messages win: `ApiResponse.message` (or the first validation
 *   error) is shown when present, so the admin sees WHY it failed;
 * - falls back to a translated generic string when the error carries nothing.
 */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);

  /** Translate with English fallback (mirrors BaseListComponent.t). */
  t(key: string, fallback: string, params?: Record<string, unknown>): string {
    if (!key) return fallback;
    const value = this.transloco.translate(key, params);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }

  /**
   * A count in the grammar of the active language.
   *
   * A toast body has no template, so it cannot use the `plural` pipe; this
   * asks the same `countMessage` the pipe asks, so "12 orders updated" is
   * worded once (`orders.bulk.updated_*`) for the toast and the dialog.
   */
  countText(base: string, count: number, params: Record<string, unknown> = {}): string {
    return countMessage(
      (key, values) => this.transloco.translate(key, values),
      this.language.language(),
      base,
      count,
      params,
    );
  }

  /** A success whose text counts things ("12 orders updated"). */
  successCount(base: string, count: number, params: Record<string, unknown> = {}): void {
    toast.success(this.countText(base, count, params));
  }

  /**
   * A counted warning that carries the way to the detail — a bulk run where
   * some rows failed says how many succeeded and offers the per-row list.
   */
  warningCountWithAction(
    base: string,
    count: number,
    action: { label: string; onClick: () => void },
    options: {
      description?: string;
      params?: Record<string, unknown>;
      durationMs?: number;
    } = {},
  ): void {
    toast.warning(this.countText(base, count, options.params), {
      duration: options.durationMs ?? 10000,
      description: options.description,
      action,
    });
  }

  success(messageKey: string, fallback: string): void {
    toast.success(this.t(messageKey, fallback));
  }

  /**
   * A client-side rejection the API never saw (a file of the wrong type, before
   * the upload is attempted). No backend message exists, so the key is the answer.
   */
  error(messageKey: string, fallback: string, params?: Record<string, unknown>): void {
    toast.error(this.t(messageKey, fallback, params));
  }

  /**
   * A warning: the work happened, but not the way the reader expected.
   * A reply that was saved but NOT emailed is exactly this — it is neither
   * a success (the customer did not hear back) nor an error (the admin's
   * words are safe).
   */
  warning(messageKey: string, fallback: string): void {
    toast.warning(this.t(messageKey, fallback));
  }

  /**
   * A warning whose text may come from the backend.
   *
   * The backend writes its own sentences (already in the reader's language) for
   * outcomes that are neither success nor failure — "the provider has not
   * accepted the message yet, a retry is queued". When it sends one, that
   * sentence wins; otherwise the translated key speaks.
   */
  warningMessage(message: string | null, fallbackKey: string, fallback: string): void {
    const text = typeof message === 'string' && message.length > 0 ? message : this.t(fallbackKey, fallback);
    toast.warning(text);
  }

  /** Backend message first, translated fallback second — never silent. */
  apiError(err: unknown, fallbackKey: string, fallback: string): void {
    toast.error(this.backendMessage(err) ?? this.t(fallbackKey, fallback));
  }

  /** Success with the backend's own message when it has one. */
  apiSuccess(res: { message?: string } | null, fallbackKey: string, fallback: string): void {
    const msg = typeof res?.message === 'string' && res.message.length > 0 ? res.message : null;
    toast.success(msg ?? this.t(fallbackKey, fallback));
  }

  /**
   * A success that carries one recovery action — the Undo of a reversible
   * change (skill rule: reversible actions run immediately, the toast offers
   * the way back for 8s instead of a confirm dialog).
   */
  successWithAction(
    messageKey: string,
    fallback: string,
    actionLabel: string,
    onAction: () => void,
    durationMs = 8000,
  ): void {
    toast.success(this.t(messageKey, fallback), {
      duration: durationMs,
      action: { label: actionLabel, onClick: onAction },
    });
  }

  /** Best-effort extraction from ApiResponse-shaped failures. */
  backendMessage(err: unknown): string | null {
    const e = err as {
      status?: number;
      error?: { message?: unknown; errors?: Array<{ field?: string; message?: string }> };
      message?: unknown;
    } | null;

    // A network failure (status 0) has no backend message: the browser's own
    // text ("Failed to fetch", "Load failed") is developer noise, not an
    // answer a person can act on (UX_AUDIT_products.md #4).
    if (e && e.status === 0) return null;

    const isNoise = (value: string): boolean =>
      /^(failed to fetch|networkerror|load failed|net::err_|http failure response)/i.test(value.trim());

    const bodyMsg = e?.error?.message;
    if (typeof bodyMsg === 'string' && bodyMsg.length > 0 && !isNoise(bodyMsg)) return bodyMsg;
    const first = e?.error?.errors?.find(
      (x) => typeof x?.message === 'string' && x.message.length > 0 && !isNoise(x.message),
    );
    if (first?.message) return first.field ? `${first.field}: ${first.message}` : first.message;
    return null;
  }
}
