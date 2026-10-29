import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../../environments/environment';
import { NotifyService } from '../../../core/notify/notify.service';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from './notification.service';
import {
  NotificationStreamEvent,
  NotificationStreamService,
  NotificationStreamStatus,
} from './notification-stream.service';
import { NotificationItem } from '../models/notification.model';

const BASE = `${environment.apiUrl}/api/dashboard/notifications`;

function item(id: number, read = false): NotificationItem {
  return {
    id,
    type: 'ORDER_CREATED',
    title: `Item ${id}`,
    message: `Message ${id}`,
    read,
    createdAt: '2026-10-27T10:00:00Z',
  };
}

function page(content: NotificationItem[], last: boolean) {
  return {
    data: { content, last, totalElements: 40, totalPages: 2, page: 0, size: 20 },
    success: true,
  };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;
  let loggedIn: ReturnType<typeof signal<boolean>>;
  let streamStatus: ReturnType<typeof signal<NotificationStreamStatus>>;
  let streamEvents: Subject<NotificationStreamEvent>;
  let streamStatusChanges: Subject<NotificationStreamStatus>;
  let stream: {
    status: () => NotificationStreamStatus;
    events: Subject<NotificationStreamEvent>;
    statusChanges: Subject<NotificationStreamStatus>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  let notify: {
    apiError: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
    backendMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    loggedIn = signal(false);
    notify = {
      apiError: vi.fn(),
      success: vi.fn(),
      backendMessage: vi.fn(() => null),
    };
    // The real service opens a socket; the store only needs its seams.
    streamStatus = signal<NotificationStreamStatus>('idle');
    streamEvents = new Subject<NotificationStreamEvent>();
    streamStatusChanges = new Subject<NotificationStreamStatus>();
    stream = {
      status: () => streamStatus(),
      events: streamEvents,
      statusChanges: streamStatusChanges,
      start: vi.fn(),
      stop: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotifyService, useValue: notify },
        {
          provide: AuthService,
          useValue: { isLoggedIn: () => loggedIn(), accessToken: () => 'jwt-token' },
        },
        { provide: NotificationStreamService, useValue: stream },
      ],
    });
    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  let realTimers = false;

  function setStreamStatus(status: NotificationStreamStatus): void {
    streamStatus.set(status);
    streamStatusChanges.next(status);
  }

  /** Pushes one SSE event into the store. */
  function pushEvent(event: string, data: unknown): void {
    streamEvents.next({ event, data: typeof data === 'string' ? data : JSON.stringify(data) });
  }

  afterEach(() => {
    if (realTimers) {
      vi.useRealTimers();
      realTimers = false;
    }
    http.verify();
    vi.restoreAllMocks();
  });

  it('loads the first page with the backend page/size contract', () => {
    service.loadItems(true);

    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.has('unreadOnly')).toBe(false);

    req.flush(page([item(1), item(2, true)], true));

    expect(service.notifications().length).toBe(2);
    expect(service.totalElements()).toBe(40);
    expect(service.totalPages()).toBe(2);
    expect(service.hasMore()).toBe(false);
    expect(service.page()).toBe(0);
  });

  it('keeps the 0-based page index in sync when jumping to page 2', () => {
    service.loadItems(true);
    http.expectOne((r) => r.url === BASE).flush(page([item(1)], false));

    service.loadPage(1);

    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('page')).toBe('1');
    req.flush(page([item(21), item(22)], true));

    // The list template renders `page() + 1`; a store that reported 0 here
    // showed "Page 1" with Prev disabled on the second page.
    expect(service.page()).toBe(1);
    expect(service.notifications().map((n) => n.id)).toEqual([21, 22]);
  });

  it('asks the backend for unread-only rows when the unread filter is on', () => {
    service.setFilter('unread');

    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('unreadOnly')).toBe('true');
    req.flush(page([item(1)], true));
  });

  it('empties the unread view when everything is marked read', () => {
    service.setFilter('unread');
    http
      .expectOne((r) => r.url === BASE)
      .flush({
        success: true,
        data: { content: [item(1), item(2)], last: true, totalElements: 2, totalPages: 1 },
      });
    service.unreadCount.set(2);

    service.markAllAsRead();
    http
      .expectOne((r) => r.method === 'PATCH' && r.url === `${BASE}/read-all`)
      .flush({ success: true });

    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
    expect(notify.success).toHaveBeenCalled();
  });

  it('marks a row read and drops it from the unread view', () => {
    service.setFilter('unread');
    http.expectOne((r) => r.url === BASE).flush(page([item(1), item(2)], true));
    service.unreadCount.set(2);

    service.markAsRead(service.notifications()[0], true);

    const req = http.expectOne((r) => r.method === 'PATCH' && r.url === `${BASE}/1/read`);
    expect(service.notifications().map((n) => n.id)).toEqual([2]);
    expect(service.unreadCount()).toBe(1);
    req.flush({ success: true });
  });

  it('restores only the row whose delete failed', () => {
    service.loadItems(true);
    http.expectOne((r) => r.url === BASE).flush(page([item(1), item(2), item(3)], true));
    const [first, second, third] = service.notifications();

    service.delete(first, true);
    service.delete(second, true);
    expect(service.notifications().map((n) => n.id)).toEqual([3]);

    http.expectOne((r) => r.method === 'DELETE' && r.url === `${BASE}/1`).flush({ success: true });
    http
      .expectOne((r) => r.method === 'DELETE' && r.url === `${BASE}/2`)
      .flush({ success: false }, { status: 500, statusText: 'Server Error' });

    // The successful delete stays gone; the failed one comes back in place.
    expect(service.notifications().map((n) => n.id)).toEqual([2, 3]);
    expect(service.notifications()[0].id).toBe(second.id);
    expect(third.id).toBe(3);
  });

  it('does not inflate the badge when an unread row is marked unread again', () => {
    service.loadItems(true);
    http.expectOne((r) => r.url === BASE).flush(page([item(1)], true));
    service.unreadCount.set(1);

    service.markAsUnread(service.notifications()[0]);

    expect(service.unreadCount()).toBe(1);
    expect(service.notifications()[0].read).toBe(false);
    http.expectNone((r) => r.method === 'PATCH');
  });

  it('deletes the whole selection in one request', () => {
    service.loadItems(true);
    http.expectOne((r) => r.url === BASE).flush(page([item(1), item(2), item(3)], true));

    service.deleteMany(service.notifications().slice(0, 2));

    const req = http.expectOne(
      (r) => r.method === 'POST' && r.url === `${BASE}/bulk-delete`,
    );
    expect(req.request.body).toEqual({ ids: [1, 2] });
    expect(service.notifications().map((n) => n.id)).toEqual([3]);

    req.flush({ success: true });
    expect(notify.success).toHaveBeenCalledTimes(1);
    http.expectNone((r) => r.method === 'DELETE');
  });

  it('marks the whole selection in one request and empties the unread view', () => {
    service.setFilter('unread');
    http.expectOne((r) => r.url === BASE).flush(page([item(1), item(2)], true));
    service.unreadCount.set(2);

    service.markManyAsRead(service.notifications());

    const req = http.expectOne(
      (r) => r.method === 'PATCH' && r.url === `${BASE}/bulk-read`,
    );
    expect(req.request.body).toEqual({ ids: [1, 2] });
    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);

    req.flush({ success: true });
    expect(notify.success).toHaveBeenCalledTimes(1);
  });

  it('does not poll for the badge while logged out', () => {
    // A root service used to poll from app start, 401-ing on the login screen
    // and forever after logout.
    http.expectNone((r) => r.url === `${BASE}/unread-count`);
  });

  it('polls once as soon as a session exists and stops on logout', () => {
    loggedIn.set(true);
    TestBed.tick();

    http.expectOne((r) => r.url === `${BASE}/unread-count`).flush({ success: true, data: 4 });
    expect(service.unreadCount()).toBe(4);

    loggedIn.set(false);
    TestBed.tick();
    http.expectNone((r) => r.url === `${BASE}/unread-count`);
  });

  it('surfaces the backend message instead of Angular’s generic HTTP text', () => {
    notify.backendMessage.mockReturnValue('Notifications service unavailable');

    service.loadItems(true);
    http
      .expectOne((r) => r.url === BASE)
      .flush(
        { success: false, message: 'Notifications service unavailable' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(service.error()).toBe('Notifications service unavailable');
    expect(notify.apiError).toHaveBeenCalled();
  });
  it('prepends a pushed notification once, even when a reload returns the same row', () => {
    loggedIn.set(true);
    TestBed.tick();
    http.expectOne((r) => r.url === `${BASE}/unread-count`).flush({ success: true, data: 0 });

    service.loadItems(true);
    http.expectOne((r) => r.url === BASE).flush(page([item(1), item(2)], true));

    pushEvent('notification', {
      id: 9,
      type: 'order.new',
      params: { orderNumber: 'ORD-9' },
      entityType: 'order',
      entityId: 9009,
      createdAt: '2026-10-29T10:00:00Z',
      readAt: null,
    });
    pushEvent('unread-count', '1');

    expect(service.notifications().map((n) => n.id)).toEqual([9, 1, 2]);
    // A pushed row is unread, and the DTO's `readAt` drives the rendered state.
    expect(service.notifications()[0].read).toBe(false);
    expect(service.unreadCount()).toBe(1);

    // The fallback reload returns the same row: it must not appear twice.
    service.loadItems(true);
    http
      .expectOne((r) => r.url === BASE)
      .flush(page([item(9), item(1), item(2)], true));

    expect(service.notifications().map((n) => n.id)).toEqual([9, 1, 2]);
    expect(service.unreadCount()).toBe(1);
  });

  it('never adds the stream count to the polled count', () => {
    loggedIn.set(true);
    TestBed.tick();
    http.expectOne((r) => r.url === `${BASE}/unread-count`).flush({ success: true, data: 0 });

    pushEvent('unread-count', '5');
    expect(service.unreadCount()).toBe(5);

    // The poll answering the same fact must set it, not add to it.
    service.refreshUnreadCount();
    http.expectOne((r) => r.url === `${BASE}/unread-count`).flush({ success: true, data: 5 });
    expect(service.unreadCount()).toBe(5);

    // Two stream events in a row are two snapshots, still not a sum.
    pushEvent('unread-count', '5');
    pushEvent('unread-count', '6');
    expect(service.unreadCount()).toBe(6);
  });

  it('does not insert a pushed row before the list has ever loaded', () => {
    loggedIn.set(true);
    TestBed.tick();
    http.expectOne((r) => r.url === `${BASE}/unread-count`).flush({ success: true, data: 0 });

    pushEvent('notification', { id: 9, type: 'order.new', readAt: null });
    pushEvent('unread-count', '1');

    // The first page request will contain it; a one-row list here would look like a
    // broken page and skip the real rows.
    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(1);
  });

  it('starts the stream with a session and stops it on logout', () => {
    loggedIn.set(true);
    TestBed.tick();
    http.expectOne((r) => r.url === `${BASE}/unread-count`).flush({ success: true, data: 0 });
    expect(stream.start).toHaveBeenCalledTimes(1);

    loggedIn.set(false);
    TestBed.tick();
    expect(stream.stop).toHaveBeenCalled();
  });

  it('pauses the poll while the stream is connected and resumes when it drops', () => {
    vi.useFakeTimers();
    realTimers = true;

    loggedIn.set(true);
    TestBed.tick();
    // The first count is fetched straight away (the stream is still connecting).
    http.expectOne((r) => r.url === `${BASE}/unread-count`).flush({ success: true, data: 3 });

    setStreamStatus('connected');
    vi.advanceTimersByTime(60_000);
    // Connected: the stream owns the count, so the poll stays silent.
    http.expectNone((r) => r.url === `${BASE}/unread-count`);

    // The stream drops: refresh at once instead of waiting for the next tick...
    setStreamStatus('offline');
    http.expectOne((r) => r.url === `${BASE}/unread-count`).flush({ success: true, data: 4 });
    expect(service.unreadCount()).toBe(4);

    // ...and the 60s fallback poll is running again.
    vi.advanceTimersByTime(60_000);
    http.expectOne((r) => r.url === `${BASE}/unread-count`).flush({ success: true, data: 5 });
    expect(service.unreadCount()).toBe(5);
  });
});
