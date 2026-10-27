import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../../environments/environment';
import { NotifyService } from '../../../core/notify/notify.service';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService } from './notification.service';
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

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotifyService, useValue: notify },
        { provide: AuthService, useValue: { isLoggedIn: () => loggedIn() } },
      ],
    });
    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
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

  it('sends one request per row for bulk delete, with one toast', () => {
    service.loadItems(true);
    http.expectOne((r) => r.url === BASE).flush(page([item(1), item(2), item(3)], true));

    service.deleteMany(service.notifications().slice(0, 2));

    const reqs = http.match((r) => r.method === 'DELETE');
    expect(reqs.length).toBe(2);
    reqs.forEach((r) => r.flush({ success: true }));

    expect(service.notifications().map((n) => n.id)).toEqual([3]);
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
});
