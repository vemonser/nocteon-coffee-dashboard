import { Injectable, signal, inject, isDevMode, effect } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  interval,
  switchMap,
  startWith,
  of,
  catchError,
  Subscription,
  fromEvent,
  filter as rxFilter,
} from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { NotificationItem, NotificationFilter } from '../models/notification.model';
import {
  NotificationStreamEvent,
  NotificationStreamService,
  NotificationStreamStatus,
} from './notification-stream.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  MOCK_NOTIFICATION_ITEMS,
  MOCK_NOTIFICATION_PARAM,
  MOCK_NOTIFICATION_DELAY_MS,
} from '../mock/notifications.mock';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private notify = inject(NotifyService);
  private auth = inject(AuthService);
  private stream = inject(NotificationStreamService);

  private baseUrl = `${environment.apiUrl}/api/dashboard/notifications`;

  readonly notifications = signal<NotificationItem[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(0);
  readonly size = 20;
  readonly hasMore = signal(true);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly filter = signal<NotificationFilter>('all');

  private polling?: Subscription;
  private visibility?: Subscription;
  private streamEvents?: Subscription;
  private streamStatus?: Subscription;
  private mockMode = false;
  private mockItems: NotificationItem[] = [];
  /**
   * True once a list request has answered. A pushed notification is only prepended
   * into a list that is already on screen; before that the first load includes it.
   */
  private listLoaded = false;

  constructor() {
    this.mockMode = this.isMockEnabled();
    if (this.mockMode) {
      this.mockItems = MOCK_NOTIFICATION_ITEMS.map((n) => ({ ...n }));
      this.notifications.set(this.mockItems);
      this.unreadCount.set(this.mockItems.filter((n) => !n.read).length);
      this.hasMore.set(false);
      this.totalElements.set(this.mockItems.length);
      this.totalPages.set(1);
      return;
    }

    // Poll only while a session exists. At boot (login screen) and after
    // logout there is nothing to count, and a 401 every minute is noise.
    // `startPolling` also fires the first fetch, so no second call here.
    effect(() => {
      if (this.auth.isLoggedIn()) this.startPolling();
      else this.stopPolling();
    });

    // Returning to the tab should not wait for the next 60s tick.
    this.visibility = fromEvent(document, 'visibilitychange')
      .pipe(rxFilter(() => document.visibilityState === 'visible'))
      .subscribe(() => this.refreshUnreadCount());

    // The stream is the fast path; the poll above is the fallback. Both write the
    // same signals, so the bell and the list can never disagree.
    this.streamEvents = this.stream.events.subscribe((event) => this.onStreamEvent(event));
    let previous: NotificationStreamStatus = 'idle';
    this.streamStatus = this.stream.statusChanges.subscribe((status) => {
      // A stream that just died leaves a gap until the next tick: close it now.
      if (status === 'offline' && previous === 'connected') this.refreshUnreadCount();
      previous = status;
    });
  }

  /**
   * One event from the SSE stream. `ready` and `heartbeat` are handled by the stream
   * service (liveness); the store only cares about data.
   */
  private onStreamEvent({ event, data }: NotificationStreamEvent): void {
    if (event === 'unread-count') {
      const count = Number.parseInt(data.trim(), 10);
      // The server's number is authoritative: this is a set, never an increment, so
      // a stream event and a poll answering the same fact cannot double-count.
      if (Number.isFinite(count) && count >= 0) this.unreadCount.set(count);
      return;
    }
    if (event === 'notification') {
      const item = this.parseNotification(data);
      if (item) this.prependLive(item);
    }
  }

  private parseNotification(data: string): NotificationItem | null {
    try {
      const raw = JSON.parse(data) as NotificationItem;
      if (raw == null || raw.id == null || !raw.type) return null;
      return this.normalize(raw);
    } catch {
      return null;
    }
  }

  /**
   * The API sends `readAt`, the UI models `read`. Normalising in one place keeps a
   * pushed row and a fetched row rendered identically.
   */
  private normalize(raw: NotificationItem): NotificationItem {
    return {
      ...raw,
      read: typeof raw.read === 'boolean' ? raw.read : !!raw.readAt,
    };
  }

  /** A new row arrives at the top of the list, at most once. */
  private prependLive(item: NotificationItem): void {
    if (!this.listLoaded) return;
    if (this.notifications().some((n) => String(n.id) === String(item.id))) return;
    this.notifications.update((list) => [item, ...list]);
    this.totalElements.update((total) => total + 1);
  }

  private isMockEnabled(): boolean {
    if (!isDevMode()) return false;
    try {
      return (
        !!MOCK_NOTIFICATION_PARAM &&
        new URLSearchParams(window.location.search).has(MOCK_NOTIFICATION_PARAM)
      );
    } catch {
      return false;
    }
  }

  isMock(): boolean {
    return this.mockMode;
  }

  private startPolling(): void {
    if (this.polling) return;
    this.stream.start(() => this.auth.accessToken());
    this.polling = interval(60000)
      .pipe(
        startWith(0),
        switchMap(() => {
          if (document.visibilityState !== 'visible') return of(null);
          // Connected means the stream already pushes the count; a poll on top of it
          // is pure duplication. The moment the stream drops this branch stops
          // short-circuiting and the poll resumes, which is the fallback.
          if (this.stream.status() === 'connected') return of(null);
          return this.http
            .get<ApiResponse<number>>(`${this.baseUrl}/unread-count`)
            .pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((res) => {
        if (res) this.unreadCount.set(res.data ?? 0);
      });
  }

  private stopPolling(): void {
    this.polling?.unsubscribe();
    this.polling = undefined;
    this.stream.stop();
    this.listLoaded = false;
  }

  refreshUnreadCount(): void {
    if (this.mockMode) {
      this.unreadCount.set(this.notifications().filter((n) => !n.read).length);
      return;
    }
    if (!this.auth.isLoggedIn()) return;
    this.http.get<ApiResponse<number>>(`${this.baseUrl}/unread-count`).subscribe({
      next: (res) => this.unreadCount.set(res.data ?? 0),
      error: () => {},
    });
  }

  loadItems(reset = true): void {
    if (this.mockMode) {
      if (MOCK_NOTIFICATION_DELAY_MS > 0) {
        this.loading.set(true);
        if (reset) this.notifications.set([]);
        setTimeout(() => this.applyMockFilter(), MOCK_NOTIFICATION_DELAY_MS);
      } else {
        this.applyMockFilter();
      }
      return;
    }
    if (!this.hasMore() && !reset) return;
    if (reset) this.page.set(0);
    this.fetch(reset ? 'replace' : 'append');
  }

  loadPage(page: number): void {
    if (this.mockMode) {
      this.applyMockFilter();
      return;
    }
    this.page.set(page);
    this.fetch('replace');
  }

  private fetch(mode: 'replace' | 'append'): void {
    this.loading.set(true);
    this.error.set(null);
    let params = new HttpParams().set('page', String(this.page())).set('size', String(this.size));
    if (this.filter() === 'unread') params = params.set('unreadOnly', 'true');

    this.http.get<ApiResponse<PageResponse<NotificationItem>>>(this.baseUrl, { params }).subscribe({
      next: (res) => {
        const content = (res.data?.content ?? []).map((n) => this.normalize(n));
        const current = mode === 'append' ? this.notifications() : [];
        // Merging by id (not plain concatenation) is what stops a pushed row from
        // appearing twice: the stream may have prepended it before this page
        // arrived, and shifting rows can repeat one at a page boundary.
        const seen = new Set(current.map((n) => String(n.id)));
        const merged = [...current];
        for (const item of content) {
          const id = String(item.id);
          if (seen.has(id)) continue;
          seen.add(id);
          merged.push(item);
        }
        this.notifications.set(merged);
        this.listLoaded = true;
        this.hasMore.set(!(res.data?.last ?? true));
        this.totalElements.set(res.data?.totalElements ?? content.length);
        this.totalPages.set(res.data?.totalPages ?? 1);
        if (mode === 'append') this.page.update((p) => p + 1);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.notify.backendMessage(err) ?? 'load_failed');
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load notifications');
      },
    });
  }

  private applyMockFilter(): void {
    const base = this.mockItems;
    const filtered = this.filter() === 'unread' ? base.filter((n) => !n.read) : base;
    this.notifications.set(filtered);
    this.loading.set(false);
    this.error.set(null);
    this.hasMore.set(false);
    this.totalElements.set(filtered.length);
    this.totalPages.set(1);
  }

  loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loadItems(false);
  }

  setFilter(f: NotificationFilter): void {
    this.filter.set(f);
    this.loadItems(true);
  }

  markAsRead(item: NotificationItem, silent = false): void {
    if (item.read) return;
    const index = this.notifications().findIndex((n) => n.id === item.id);
    const prevCount = this.unreadCount();
    // A read item must leave the "Unread" view immediately.
    const leavesUnreadView = this.filter() === 'unread';

    this.notifications.update((list) => {
      const next = list.map((n) => (n.id === item.id ? { ...n, read: true } : n));
      return leavesUnreadView ? next.filter((n) => n.id !== item.id) : next;
    });
    if (leavesUnreadView) this.totalElements.update((t) => Math.max(0, t - 1));
    this.unreadCount.set(Math.max(0, prevCount - 1));

    if (this.mockMode) {
      this.mockItems = this.mockItems.map((n) => (n.id === item.id ? { ...n, read: true } : n));
      this.applyMockFilter();
      return;
    }

    this.http.patch(`${this.baseUrl}/${item.id}/read`, null).subscribe({
      next: () => {
        if (!silent) this.notify.success('notifications.markedRead', 'Marked as read');
      },
      error: (err) => {
        this.notifications.update((list) => {
          const restored = list.map((n) => (n.id === item.id ? { ...n, read: false } : n));
          if (!leavesUnreadView) return restored;
          if (restored.some((n) => n.id === item.id)) return restored;
          const copy = [...restored];
          copy.splice(Math.max(0, Math.min(index, copy.length)), 0, { ...item, read: false });
          return copy;
        });
        if (leavesUnreadView) this.totalElements.update((t) => t + 1);
        this.unreadCount.set(prevCount);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not mark as read');
      },
    });
  }

  markAllAsRead(): void {
    const prevItems = this.notifications();
    const prevCount = this.unreadCount();
    const prevTotal = this.totalElements();
    const unreadIds = new Set(prevItems.filter((n) => !n.read).map((n) => n.id));
    const leavesUnreadView = this.filter() === 'unread';

    this.notifications.set(leavesUnreadView ? [] : prevItems.map((n) => ({ ...n, read: true })));
    if (leavesUnreadView) this.totalElements.set(0);
    this.unreadCount.set(0);

    if (this.mockMode) {
      this.mockItems = this.mockItems.map((n) => ({ ...n, read: true }));
      this.applyMockFilter();
      this.unreadCount.set(0);
      this.notify.success('notifications.allMarkedAsRead', 'All marked as read');
      return;
    }

    this.http.patch(`${this.baseUrl}/read-all`, null).subscribe({
      next: () => {
        this.notify.success('notifications.allMarkedAsRead', 'All marked as read');
      },
      error: (err) => {
        // Restore only what was unread: a whole-list snapshot would resurrect
        // items deleted while this request was in flight.
        this.notifications.set(
          prevItems.map((n) => (unreadIds.has(n.id) ? { ...n, read: false } : n)),
        );
        this.totalElements.set(prevTotal);
        this.unreadCount.set(prevCount);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not mark all as read');
      },
    });
  }

  markAsUnread(item: NotificationItem): void {
    // Already unread: the old code incremented the badge anyway.
    if (!item.read) return;
    const prevCount = this.unreadCount();

    this.notifications.update((list) =>
      list.map((n) => (n.id === item.id ? { ...n, read: false } : n)),
    );
    this.unreadCount.update((c) => c + 1);

    if (this.mockMode) {
      this.mockItems = this.mockItems.map((n) => (n.id === item.id ? { ...n, read: false } : n));
      this.applyMockFilter();
      return;
    }

    this.http.patch(`${this.baseUrl}/${item.id}/unread`, null).subscribe({
      next: () => {},
      error: (err) => {
        this.notifications.update((list) =>
          list.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
        );
        this.unreadCount.set(prevCount);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not mark as unread');
      },
    });
  }

  delete(item: NotificationItem, silent = false): void {
    const index = this.notifications().findIndex((n) => n.id === item.id);
    const wasUnread = !item.read;
    const prevCount = this.unreadCount();

    this.notifications.update((list) => list.filter((n) => n.id !== item.id));
    if (wasUnread) this.unreadCount.update((c) => Math.max(0, c - 1));

    if (this.mockMode) {
      this.mockItems = this.mockItems.filter((n) => n.id !== item.id);
      this.applyMockFilter();
      if (!silent) this.notify.success('notifications.deleted', 'Deleted');
      return;
    }

    this.http.delete(`${this.baseUrl}/${item.id}`).subscribe({
      next: () => {
        if (!silent) this.notify.success('notifications.deleted', 'Deleted');
      },
      error: (err) => {
        this.restoreDeleted(item, index);
        if (wasUnread) this.unreadCount.set(prevCount);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not delete');
      },
    });
  }

  /** One request for the whole selection (the API has a bulk delete). */
  deleteMany(items: NotificationItem[]): void {
    const targets = items.filter((i) => this.notifications().some((n) => n.id === i.id));
    if (targets.length === 0) return;

    if (this.mockMode) {
      targets.forEach((i) => this.delete(i, true));
      this.notify.success('notifications.deleted', 'Deleted');
      return;
    }

    const ids = targets.map((i) => i.id);
    const unreadRemoved = targets.filter((i) => !i.read).length;
    const prevTotal = this.totalElements();

    this.notifications.update((list) =>
      list.filter((n) => !ids.includes(n.id)),
    );
    this.unreadCount.update((c) => Math.max(0, c - unreadRemoved));
    this.totalElements.update((total) => Math.max(0, total - targets.length));

    this.http.post(`${this.baseUrl}/bulk-delete`, { ids }).subscribe({
      next: () => this.notify.success('notifications.deleted', 'Deleted'),
      error: (err) => {
        // The server is the truth after a failed batch: reload rather than
        // guess which rows survived.
        this.totalElements.set(prevTotal);
        this.loadItems(true);
        this.refreshUnreadCount();
        this.notify.apiError(err, 'notify.errorFallback', 'Could not delete');
      },
    });
  }

  /** One request for the whole selection (the API has a bulk mark-read). */
  markManyAsRead(items: NotificationItem[]): void {
    const targets = items.filter((i) => !i.read);
    if (targets.length === 0) return;

    if (this.mockMode) {
      targets.forEach((i) => this.markAsRead(i, true));
      this.notify.success('notifications.markedRead', 'Marked as read');
      return;
    }

    const ids = targets.map((i) => i.id);
    const removedByFilter = this.filter() === 'unread';
    const prevCount = this.unreadCount();

    this.notifications.update((list) => {
      const next = list.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n));
      return removedByFilter ? next.filter((n) => !ids.includes(n.id)) : next;
    });
    if (removedByFilter) {
      this.totalElements.update((t) => Math.max(0, t - targets.length));
    }
    this.unreadCount.update((c) => Math.max(0, c - targets.length));

    this.http.patch(`${this.baseUrl}/bulk-read`, { ids }).subscribe({
      next: () => this.notify.success('notifications.markedRead', 'Marked as read'),
      error: (err) => {
        this.unreadCount.set(prevCount);
        this.loadItems(true);
        this.refreshUnreadCount();
        this.notify.apiError(err, 'notify.errorFallback', 'Could not mark as read');
      },
    });
  }

  private restoreDeleted(item: NotificationItem, index: number): void {
    this.notifications.update((list) => {
      if (list.some((n) => n.id === item.id)) return list;
      const copy = [...list];
      copy.splice(Math.max(0, Math.min(index, copy.length)), 0, item);
      return copy;
    });
  }
}
