import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';

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

  /** Translate with English fallback (mirrors BaseListComponent.t). */
  t(key: string, fallback: string): string {
    if (!key) return fallback;
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }

  success(messageKey: string, fallback: string): void {
    toast.success(this.t(messageKey, fallback));
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
