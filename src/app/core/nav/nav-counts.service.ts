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
  private readonly _available = signal(false);

  readonly counts = this._counts.asReadonly();
  readonly available = this._available.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Dev-only mock flag: ?mockNavCounts=1 or localStorage devMockNavCounts=1
    if (this.isMock()) {
      this._counts.set({ orders: 5, carts: 2, reviews: 3, contact: 4 });
      this._available.set(true);
      return;
    }

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
    this._available.set(false);
  }

  private isMock(): boolean {
    try {
      if (localStorage.getItem('devMockNavCounts') === '1') return true;
      return new URLSearchParams(window.location.search).get('mockNavCounts') === '1';
    } catch {
      return false;
    }
  }

  fetch(): void {
    if (!this.auth.isLoggedIn()) return;
    this.http
      .get<any>(`${environment.apiUrl}/api/dashboard/nav-counts`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          const d = res?.data ?? res ?? {};
          const next: NavCounts = {};
          let has = false;
          const pick = (keys: string[]): number | undefined => {
            for (const k of keys) {
              if (Object.prototype.hasOwnProperty.call(d, k) && d[k] != null) {
                const n = Number(d[k]);
                if (Number.isFinite(n)) return n;
              }
            }
            return undefined;
          };
          const o = pick(['ordersOpen', 'openOrders', 'orders']);
          if (o !== undefined) { next.orders = o; has = true; }
          const c = pick(['cartsAbandoned', 'abandonedCarts', 'carts']);
          if (c !== undefined) { next.carts = c; has = true; }
          const r = pick(['reviewsPending', 'pendingReviews', 'reviews']);
          if (r !== undefined) { next.reviews = r; has = true; }
          const ct = pick(['contactUnread', 'unreadContact', 'contactMessages', 'contact']);
          if (ct !== undefined) { next.contact = ct; has = true; }
          if (has) {
            this._counts.set(next);
            this._available.set(true);
          }
        },
        error: () => {
          // endpoint missing or forbidden: no badges
          this._available.set(false);
          this._counts.set(null);
        },
      });
  }

  refresh(): void {
    this.fetch();
  }

  badgeFor(route: string): number | null {
    if (!this._available()) return null;
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