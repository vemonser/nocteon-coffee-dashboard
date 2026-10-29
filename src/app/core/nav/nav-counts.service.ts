import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

export interface NavCounts {
  orders?: number;
  carts?: number;
  reviews?: number;
  contact?: number;
}

/**
 * A nav badge as the shell needs it: the number to render, and the PLURAL BASE
 * of its accessible name.
 *
 * The label is a KEY, never a sentence. The sidebar resolves it through the
 * plural pipe, so the name is worded by the active language and follows a
 * runtime language switch. Building the sentence here (the old `ariaLabel()`)
 * froze it in English: an Arabic UI announced "3 pending" to a screen reader,
 * and the string was not in the locale files at all.
 *
 * `orders.countPending` (2) and `carts.countAbandoned` (1) are new; the reviews
 * and contact families already existed and are reused verbatim.
 */
export interface NavBadge {
  /** The number on the badge. 0 is a real answer — the sidebar hides it. */
  count: number;
  /** Plural base key: `<base>_<Intl.PluralRules category>`. */
  labelKey: string;
}

@Injectable({ providedIn: 'root' })
export class NavCountsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _counts = signal<NavCounts | null>(null);
  private errorLogged = false;

  readonly counts = this._counts.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Poll only while a session exists. This is a root service: started at
    // boot it fetched on the login screen and kept 401-ing every minute after
    // logout, while the badge kept showing the previous admin's counts.
    effect(() => {
      if (this.auth.isLoggedIn() && this.canReadCounts()) this.startPolling();
      else this.stopPolling();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.fetch();
    });
  }

  private canReadCounts(): boolean {
    return (
      this.auth.hasPermission('order:read') ||
      this.auth.hasPermission('cart:read_all') ||
      this.auth.hasPermission('review:moderate') ||
      this.auth.hasPermission('contact:read')
    );
  }

  private startPolling(): void {
    if (this.timer) return;
    this.fetch();
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') this.fetch();
    }, 60000);
  }

  private stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._counts.set(null);
  }

  fetch(): void {
    if (!this.auth.isLoggedIn()) return;
    this.http
      .get<any>(`${environment.apiUrl}/api/dashboard/nav-counts`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          // GET /api/dashboard/nav-counts. A key is omitted when the signed-in
          // role cannot read that area, so a missing key means "no badge" —
          // it is not a zero and never an error.
          const d = res?.data ?? {};
          this._counts.set({
            orders: toCount(d.openOrders),
            carts: toCount(d.abandonedCarts),
            reviews: toCount(d.pendingReviews),
            contact: toCount(d.contactUnread),
          });
        },
        error: () => {
          // A failed count is not a reason to break the sidebar: keep the last
          // good badge numbers and log the failure once instead of spamming the
          // console on every poll.
          if (!this.errorLogged) {
            this.errorLogged = true;
            console.warn('Nav counts could not be loaded; keeping the last known values.');
          }
        },
      });
  }

  refresh(): void {
    this.fetch();
  }

  badgeFor(route: string): NavBadge | null {
    const c = this._counts();
    if (!c) return null;
    if (route.includes('/orders')) return badge(c.orders, 'orders.countPending');
    if (route.includes('/carts')) return badge(c.carts, 'carts.countAbandoned');
    if (route.includes('/reviews')) return badge(c.reviews, 'reviews.countPending');
    if (route.includes('/contact-messages')) return badge(c.contact, 'contactMessages.countUnread');
    return null;
  }
}

/**
 * A badge, or nothing at all.
 *
 * A key the endpoint omitted means "this role cannot read that area", which is
 * no badge — it is not a zero, so it must not fall back to one.
 */
function badge(count: number | undefined, labelKey: string): NavBadge | null {
  return count === undefined ? null : { count, labelKey };
}

function toCount(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}
