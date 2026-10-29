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

  badgeFor(route: string): number | null {
    const c = this._counts();
    if (!c) return null;
    if (route.includes('/orders')) return c.orders ?? null;
    if (route.includes('/carts')) return c.carts ?? null;
    if (route.includes('/reviews')) return c.reviews ?? null;
    if (route.includes('/contact-messages')) return c.contact ?? null;
    return null;
  }

  ariaLabel(route: string, n: number): string {
    if (route.includes('/contact-messages')) return `${n} unread`;
    return `${n} pending`;
  }
}

function toCount(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}
