import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NotificationStreamEvent,
  NotificationStreamService,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  STREAM_JITTER,
  STREAM_WATCHDOG_MS,
  parseEventBlock,
  reconnectDelay,
} from './notification-stream.service';

/** A body that yields the given chunks and then closes. */
function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(encoder.encode(chunks[index++]));
      else controller.close();
    },
  });
}

/** A body that never produces anything and never closes (a silent connection). */
function silentStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    pull() {
      /* nothing, ever */
    },
  });
}

function ok(body: ReadableStream<Uint8Array>): Response {
  return { ok: true, status: 200, body } as unknown as Response;
}

describe('reconnectDelay', () => {
  it('grows exponentially and caps', () => {
    // random() === 0 leaves the fixed half of the equal-jitter window.
    expect(reconnectDelay(0, () => 0)).toBe(500);
    expect(reconnectDelay(1, () => 0)).toBe(1000);
    expect(reconnectDelay(2, () => 0)).toBe(2000);
    expect(reconnectDelay(3, () => 0)).toBe(4000);
    // 1s * 2^5 = 32s -> capped at 30s, half of it fixed.
    expect(reconnectDelay(5, () => 0)).toBe(RECONNECT_MAX_MS / 2);
    expect(reconnectDelay(20, () => 0)).toBe(RECONNECT_MAX_MS / 2);
  });

  it('keeps the jittered delay inside the window and never above the cap', () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const window = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
      const low = reconnectDelay(attempt, () => 0);
      const high = reconnectDelay(attempt, () => 0.999);
      expect(low).toBe(Math.round(window / 2));
      expect(high).toBeLessThanOrEqual(window);
      expect(high).toBeGreaterThanOrEqual(Math.round(window / 2));
    }
    for (let i = 0; i < 50; i++) {
      expect(reconnectDelay(30)).toBeLessThanOrEqual(RECONNECT_MAX_MS);
    }
  });
});

describe('parseEventBlock', () => {
  it('reads the event name and joins multi-line data', () => {
    expect(parseEventBlock('event: notification\ndata: {"id":1}\ndata: {"id":2}')).toEqual({
      event: 'notification',
      data: '{"id":1}\n{"id":2}',
    });
  });

  it('ignores comments and blank lines, and defaults to `message`', () => {
    expect(parseEventBlock(': keep-alive')).toBeNull();
    expect(parseEventBlock('data: 7')).toEqual({ event: 'message', data: '7' });
  });
});

describe('NotificationStreamService', () => {
  let service: NotificationStreamService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let events: NotificationStreamEvent[];
  let statuses: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: STREAM_JITTER, useValue: () => 0 }],
    });
    service = TestBed.inject(NotificationStreamService);
    events = [];
    statuses = [];
    service.events.subscribe((event) => events.push(event));
    service.statusChanges.subscribe((status) => statuses.push(status));
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the bearer token as a header, not as a query parameter', async () => {
    fetchMock.mockResolvedValue(ok(streamOf()));

    service.start(() => 'jwt-token');
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('token');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer jwt-token' });
  });

  it('dispatches parsed events and reaches `connected`', async () => {
    fetchMock.mockResolvedValue(
      ok(
        streamOf(
          'event: ready\ndata: {"userId":1}\n\n',
          // A block split across chunks must still parse.
          'event: notification\ndata: {"id":9,"type":"order.new"}\n',
          '\n',
          'event: unread-count\ndata: 3\n\n',
        ),
      ),
    );

    service.start(() => 'jwt-token');
    await vi.advanceTimersByTimeAsync(0);

    // The fixture closes the body, so the connection ends `offline` with a
    // reconnect pending; what matters is that it was connected and dispatched.
    expect(statuses).toContain('connected');
    expect(statuses).toContain('offline');
    expect(events).toEqual([
      { event: 'ready', data: '{"userId":1}' },
      { event: 'notification', data: '{"id":9,"type":"order.new"}' },
      { event: 'unread-count', data: '3' },
    ]);
  });

  it('backs off exponentially with jitter when the stream keeps failing', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    service.start(() => 'jwt-token');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('offline');

    // attempt 0 -> 500ms
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // attempt 1 -> 1000ms
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // attempt 2 -> 2000ms
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(service.status()).toBe('offline');
  });

  it('resets the backoff after a live connection, not after a bare handshake', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(ok(streamOf('event: heartbeat\ndata: {"timestamp":"x"}\n\n')))
      .mockRejectedValue(new Error('down'));

    service.start(() => 'jwt-token');
    await vi.advanceTimersByTimeAsync(0); // call 1 -> 500ms
    await vi.advanceTimersByTimeAsync(500); // call 2 -> 1000ms
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Call 3 delivers a heartbeat, which proves the connection was real, so the
    // attempt counter resets and the next retry is the base delay again — 4000ms
    // would be the growing delay if the counter had survived.
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('reconnects when the server goes silent (watchdog)', async () => {
    fetchMock.mockResolvedValue(ok(silentStream()));

    service.start(() => 'jwt-token');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('connected');

    await vi.advanceTimersByTimeAsync(STREAM_WATCHDOG_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('connected');

    await vi.advanceTimersByTimeAsync(1);
    expect(service.status()).toBe('offline');

    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not open a stream without a token', async () => {
    service.start(() => null);
    await vi.advanceTimersByTimeAsync(600);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(service.status()).toBe('offline');
  });

  it('stop() aborts the connection and cancels a pending reconnect', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    service.start(() => 'jwt-token');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    service.stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('idle');
  });
});
