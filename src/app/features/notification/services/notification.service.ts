import { Injectable, signal, inject, isDevMode } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { interval, switchMap, startWith, of, catchError, Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { NotificationItem, NotificationFilter } from '../models/notification.model';
import { NotifyService } from '../../../core/notify/notify.service';
import {
  MOCK_NOTIFICATION_ITEMS,
  MOCK_NOTIFICATION_PARAM,
  MOCK_NOTIFICATION_DELAY_MS,
} from '../mock/notifications.mock';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private notify = inject(NotifyService);

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

  private destroy$ = new Subject<void>();
  private mockMode = false;
  private mockItems: NotificationItem[] = [];

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
    this.startPolling();
    this.refreshUnreadCount();
  }

  private isMockEnabled(): boolean {
    if (!isDevMode()) return false;
    try {
      return !!MOCK_NOTIFICATION_PARAM && new URLSearchParams(window.location.search).has(MOCK_NOTIFICATION_PARAM);
    } catch {
      return false;
    }
  }

  isMock(): boolean {
    return this.mockMode;
  }

  private startPolling(): void {
    interval(60000)
      .pipe(
        startWith(0),
        switchMap(() => {
          if (document.visibilityState !== 'visible') return of(null);
          return this.http
            .get<ApiResponse<number>>(`${this.baseUrl}/unread-count`)
            .pipe(catchError(() => of(null)));
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((res) => {
        if (res) this.unreadCount.set(res.data ?? 0);
      });
  }

  refreshUnreadCount(): void {
    if (this.mockMode) {
      this.unreadCount.set(this.notifications().filter((n) => !n.read).length);
      return;
    }
    this.http
      .get<ApiResponse<number>>(`${this.baseUrl}/unread-count`)
      .subscribe({
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
    let params = new HttpParams()
      .set('page', String(this.page()))
      .set('size', String(this.size));
    if (this.filter() === 'unread') params = params.set('unreadOnly', 'true');

    this.http
      .get<ApiResponse<PageResponse<NotificationItem>>>(this.baseUrl, { params })
      .subscribe({
        next: (res) => {
          const content = res.data?.content ?? [];
          const current = mode === 'append' ? this.notifications() : [];
          this.notifications.set([...current, ...content]);
          this.hasMore.set(!(res.data?.last ?? true));
          this.totalElements.set(res.data?.totalElements ?? content.length);
          this.totalPages.set(res.data?.totalPages ?? 1);
          if (mode === 'append') this.page.update((p) => p + 1);
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.message || 'load_failed');
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
    const prev = item.read;
    this.notifications.update((list) =>
      list.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
    );
    const prevCount = this.unreadCount();
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
        this.notifications.update((list) =>
          list.map((n) => (n.id === item.id ? { ...n, read: prev } : n)),
        );
        this.unreadCount.set(prevCount);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not mark as read');
      },
    });
  }

  markAllAsRead(): void {
    const prevItems = this.notifications();
    const prevCount = this.unreadCount();
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
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
        this.notifications.set(prevItems);
        this.unreadCount.set(prevCount);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not mark all as read');
      },
    });
  }

  markAsUnread(item: NotificationItem): void {
    const prev = item.read;
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
          list.map((n) => (n.id === item.id ? { ...n, read: prev } : n)),
        );
        this.unreadCount.update((c) => Math.max(0, c - 1));
        this.notify.apiError(err, 'notify.errorFallback', 'Could not mark as unread');
      },
    });
  }

  delete(item: NotificationItem): void {
    const prevItems = this.notifications();
    const wasUnread = !item.read;
    this.notifications.update((list) => list.filter((n) => n.id !== item.id));
    if (wasUnread) this.unreadCount.update((c) => Math.max(0, c - 1));

    if (this.mockMode) {
      this.mockItems = this.mockItems.filter((n) => n.id !== item.id);
      this.applyMockFilter();
      this.notify.success('notifications.deleted', 'Deleted');
      return;
    }

    this.http.delete(`${this.baseUrl}/${item.id}`).subscribe({
      next: () => {
        this.notify.success('notifications.deleted', 'Deleted');
      },
      error: (err) => {
        this.notifications.set(prevItems);
        if (wasUnread) this.unreadCount.update((c) => c + 1);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not delete');
      },
    });
  }

  deleteMany(items: NotificationItem[]): void {
    items.forEach((i) => this.delete(i));
  }

  markManyAsRead(items: NotificationItem[]): void {
    items.forEach((i) => this.markAsRead(i, true));
    this.notify.success('notifications.markedRead', 'Marked as read');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
