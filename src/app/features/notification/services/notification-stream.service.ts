import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type NotificationStreamStatus = 'idle' | 'connecting' | 'connected' | 'offline';

export interface NotificationStreamEvent {
  /** SSE `event:` name, e.g. `notification`, `unread-count`, `ready`, `heartbeat`. */
  event: string;
  /** Raw `data:` payload (JSON for `notification`, a plain number for `unread-count`). */
  data: string;
}

/**
 * Jitter source, injectable so the reconnect schedule is deterministic in tests.
 * Production uses `Math.random`.
 */
export const STREAM_JITTER = new InjectionToken<() => number>('STREAM_JITTER', {
  providedIn: 'root',
  factory: () => Math.random,
});

/** First retry gap before jitter. */
export const RECONNECT_BASE_MS = 1000;
/** Ceiling for the exponential growth. */
export const RECONNECT_MAX_MS = 30_000;
/**
 * Silence longer than this means the stream is dead even if the socket is not:
 * the server heartbeats every 25 s, so two missed beats are a lost connection.
 */
export const STREAM_WATCHDOG_MS = 70_000;

/**
 * Exponential backoff with equal jitter: half the window is fixed and the other
 * half is random, so a hundred tabs that lost the server at the same moment do not
 * all return together, while the growth stays predictable (1s, 2s, 4s … capped).
 */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const capped = Math.min(RECONNECT_BASE_MS * Math.pow(2, Math.max(0, attempt)), RECONNECT_MAX_MS);
  return Math.round(capped / 2 + random() * (capped / 2));
}

/**
 * Server-sent-event client for the dashboard notification stream.
 *
 * <p>Uses `fetch` and a streamed body rather than `EventSource` for one reason:
 * `EventSource` cannot attach an `Authorization` header, and the endpoint
 * deliberately accepts no token in the query string. This keeps the stream on
 * exactly the same bearer-token path as every REST call.
 *
 * <p>Everything here is invisible to the user: connection state and reconnects are
 * logged to the console only. The UI never shows a "reconnecting" banner, because
 * the notification store keeps polling while the stream is down.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStreamService {
  private jitter = inject(STREAM_JITTER);

  private readonly statusSignal = signal<NotificationStreamStatus>('idle');
  readonly status = this.statusSignal.asReadonly();

  private readonly eventsSubject = new Subject<NotificationStreamEvent>();
  readonly events: Observable<NotificationStreamEvent> = this.eventsSubject.asObservable();

  private readonly statusSubject = new Subject<NotificationStreamStatus>();
  /** Status transitions only; the fallback poll listens for `connected` -> `offline`. */
  readonly statusChanges: Observable<NotificationStreamStatus> = this.statusSubject.asObservable();

  private tokenProvider: (() => string | null) | null = null;
  private controller: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private running = false;

  private readonly url = `${environment.apiUrl}/api/dashboard/notifications/stream`;

  /**
   * Opens the stream and keeps it open. Idempotent: calling it twice does not open a
   * second connection.
   */
  start(tokenProvider: () => string | null): void {
    this.tokenProvider = tokenProvider;
    if (this.running) return;
    this.running = true;
    this.attempt = 0;
    void this.open();
  }

  /** Stops the stream and any pending reconnect (logout, or the store shutting down). */
  stop(): void {
    this.running = false;
    this.tokenProvider = null;
    this.clearTimers();
    this.controller?.abort();
    this.controller = null;
    this.setStatus('idle');
    console.debug('[notifications] stream stopped');
  }

  private setStatus(status: NotificationStreamStatus): void {
    if (this.statusSignal() === status) return;
    this.statusSignal.set(status);
    this.statusSubject.next(status);
  }

  private async open(): Promise<void> {
    const token = this.tokenProvider?.() ?? null;
    if (!this.running) return;
    if (!token) {
      // Not signed in yet: back off instead of hammering an endpoint that will 401.
      this.reconnect('no access token', true);
      return;
    }

    this.setStatus('connecting');
    const controller = new AbortController();
    this.controller = controller;

    try {
      const response = await fetch(this.url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.setStatus('connected');
      this.armWatchdog();
      console.debug('[notifications] stream connected');

      await this.pump(response.body);
      // A clean end of stream is the server's own timeout, not a failure: the
      // client comes back immediately-ish without growing the delay.
      this.reconnect('stream closed by the server', false);
    } catch (error) {
      if (controller.signal.aborted) return;
      this.reconnect(errorMessage(error), true);
    }
  }

  /** Reads the body and dispatches every complete SSE block. */
  private async pump(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (this.running) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const parsed = parseEventBlock(block);
          if (parsed) this.dispatch(parsed);
          boundary = buffer.indexOf('\n\n');
        }
      }
    } finally {
      reader.releaseLock();
      try {
        await body.cancel();
      } catch {
        // Already closed by the server or the abort.
      }
    }
  }

  private dispatch(event: NotificationStreamEvent): void {
    // `ready` only proves the handshake; a real event or a heartbeat proves the
    // connection is alive. A server that accepts and immediately drops the stream
    // therefore still grows the delay instead of looping every second.
    if (event.event !== 'ready') this.attempt = 0;
    this.armWatchdog();
    this.eventsSubject.next(event);
  }

  private armWatchdog(): void {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      if (!this.running) return;
      this.reconnect('no heartbeat from the server', true);
    }, STREAM_WATCHDOG_MS);
  }

  private reconnect(reason: string, growBackoff: boolean): void {
    if (!this.running) return;
    this.clearWatchdog();
    this.controller?.abort();
    this.controller = null;
    this.setStatus('offline');
    this.scheduleReconnect(reason, growBackoff);
  }

  private scheduleReconnect(reason: string, growBackoff = true): void {
    if (!this.running) return;
    if (this.reconnectTimer) return;
    const delay = reconnectDelay(this.attempt, this.jitter);
    if (growBackoff) this.attempt += 1;
    else this.attempt = 0;
    console.debug(
      `[notifications] stream offline (${reason}); reconnecting in ${delay}ms (attempt ${this.attempt})`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.running) return;
      void this.open();
    }, delay);
  }

  private clearTimers(): void {
    this.clearWatchdog();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

/**
 * Parses one SSE block. Comments (`: keep-alive`) and unknown fields are ignored;
 * several `data:` lines are joined with a newline, as the spec says.
 */
export function parseEventBlock(block: string): NotificationStreamEvent | null {
  let event = 'message';
  const data: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  if (data.length === 0) return null;
  return { event, data: data.join('\n') };
}
