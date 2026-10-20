import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import {
  OrderFilterRequest,
  OrderResponse,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../models/order.model';

/**
 * The orders service.
 *
 * What the API accepts today (backend `OrderFilterRequest` extends
 * `BaseFilterRequest`): `page`, `size`, `sort`, `direction`, `status`,
 * `userId`.
 *
 * What it does NOT accept: `search`, `paymentStatus`, `paymentMethod`,
 * `dateFrom`, `dateTo`. There is also no stats endpoint. Those gaps are
 * written up in ORDERS_CONTRACT.md; until they exist, the list fetches the
 * whole set and filters it here, so the numbers on screen are still exact.
 */

/** The API refuses a page size above 100 (BaseFilterRequest: @Max(100)). */
export const API_MAX_PAGE_SIZE = 100;

/**
 * The cap on how many orders the list pulls for the client-side filters.
 *
 * The list fetches the whole set so that the filters the API does not
 * support (payment status, payment method, date range, search) and the
 * counts the cards show are EXACT, not "the rows on this page". A store with
 * more orders than this hits the cap, and the list says so instead of
 * quietly showing a partial count.
 */
export const CLIENT_FILTER_FETCH_CAP = 1000;

export interface OrderStatusUpdate {
  status: OrderStatus;
  /** Optional note. The backend ignores it today (see ORDERS_CONTRACT.md). */
  note?: string;
  /** Whether the customer should be notified. Also ignored by the backend. */
  notifyCustomer?: boolean;
  /** Required when the new status is CANCELLED. */
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/orders`;

  /**
   * One page of orders, exactly as the API returns it.
   *
   * `sort` and `direction` are sent to the server — the table uses
   * `manualSorting`, so the ORDERING is the backend's, never the browser's.
   */
  getAll(params: OrderFilterRequest = {}): Observable<ApiResponse<PageResponse<OrderResponse>>> {
    let p = new HttpParams().set('page', params.page ?? 0).set('size', params.size ?? 20);

    if (params.sort) p = p.set('sort', params.sort);
    if (params.direction) p = p.set('direction', params.direction);
    if (params.status) p = p.set('status', params.status);
    if (params.userId) p = p.set('userId', params.userId.toString());
    if (params.search) p = p.set('search', params.search);

    return this.http.get<ApiResponse<PageResponse<OrderResponse>>>(this.base, { params: p });
  }

  /**
   * EVERY order, paged through.
   *
   * The pages are requested with the SAME sort and direction, so the
   * concatenation is globally ordered by the server — a client that pages
   * through a sorted list gets the sorted list.
   *
   * The set is capped (see `CLIENT_FILTER_FETCH_CAP`); `truncated` says
   * whether the cap was reached, so the caller can tell the reader that the
   * numbers cover only part of the store.
   */
  getAllOrders(
    params: { sort?: string; direction?: string; status?: OrderStatus } = {},
  ): Observable<{ orders: OrderResponse[]; truncated: boolean; totalElements: number }> {
    return this.getAll({ page: 0, size: API_MAX_PAGE_SIZE, ...params }).pipe(
      switchMap((res) => {
        const page = res.data;
        const totalElements = page?.totalElements ?? 0;
        const totalPages = page?.totalPages ?? 1;
        const maxPages = Math.max(1, Math.ceil(CLIENT_FILTER_FETCH_CAP / API_MAX_PAGE_SIZE));
        const extraPages = Math.min(totalPages - 1, maxPages - 1);

        const first = page?.content ?? [];
        if (extraPages <= 0) {
          return of({ pages: [first], totalElements });
        }

        const requests = Array.from({ length: extraPages }, (_, i) =>
          this.getAll({ page: i + 1, size: API_MAX_PAGE_SIZE, ...params }).pipe(
            map((r) => r.data?.content ?? []),
          ),
        );
        return forkJoin(requests).pipe(map((pages) => ({ pages: [first, ...pages], totalElements })));
      }),
      map(({ pages, totalElements }) => {
        const orders = pages.flat();
        return {
          orders: orders.slice(0, CLIENT_FILTER_FETCH_CAP),
          truncated: totalElements > CLIENT_FILTER_FETCH_CAP,
          totalElements,
        };
      }),
    );
  }

  /** One order, with its items, its address and its customer. */
  getById(id: number): Observable<ApiResponse<OrderResponse>> {
    return this.http.get<ApiResponse<OrderResponse>>(`${this.base}/${id}`);
  }

  /**
   * Change an order's status.
   *
   * The endpoint is `PUT /api/dashboard/orders/{id}/status`. The body it
   * accepts today is `{ status }`; the note, the notify flag and the cancel
   * reason are part of the contract this work proposes (ORDERS_CONTRACT.md)
   * and are sent only when the backend declares support for them.
   */
  updateStatus(
    id: number,
    update: OrderStatusUpdate,
    options: { supportsNote?: boolean } = {},
  ): Observable<ApiResponse<OrderResponse>> {
    const body: Record<string, unknown> = { status: update.status };
    if (options.supportsNote && update.note) body['note'] = update.note;
    if (options.supportsNote && update.notifyCustomer) body['notifyCustomer'] = true;
    if (options.supportsNote && update.reason) body['reason'] = update.reason;

    return this.http.put<ApiResponse<OrderResponse>>(`${this.base}/${id}/status`, body);
  }

  /**
   * The filters the API does not support today.
   *
   * The list shows them and applies them itself, so the numbers are right
   * even though the API cannot filter. The list uses this list to say, in
   * the contract report, exactly what the API is missing.
   */
  static readonly UNSUPPORTED_FILTERS: ReadonlyArray<
    keyof OrderFilterRequest & ('paymentStatus' | 'paymentMethod' | 'dateFrom' | 'dateTo' | 'search')
  > = ['paymentStatus', 'paymentMethod', 'dateFrom', 'dateTo', 'search'];
}
