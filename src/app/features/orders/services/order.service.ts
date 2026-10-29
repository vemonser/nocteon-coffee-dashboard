import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, forkJoin, map, of, switchMap, toArray } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import {
  BulkStatusRowResult,
  OrderFilterRequest,
  OrderResponse,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../models/order.model';
import { invoiceFilenameFrom } from '../utils/invoice-filename';
import {
  CreateReturnPayload,
  OrderConfirmationResend,
  OrderNote,
  OrderPaymentDetails,
  OrderRefund,
  OrderReturn,
  OrderShipment,
  OrderStats,
  OrderStatusHistoryEntry,
} from '../models/order-activity.model';

/**
 * The orders service.
 *
 * The list and the counts take the SAME filters, so the cards and the rows
 * always describe the same set — the API filters server-side, and the
 * browser never filters a page of rows it happens to have.
 */
@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/orders`;

  /** The biggest page the API accepts (`size` is validated, max 100). */
  private static readonly MAX_PAGE_SIZE = 100;

  /**
   * EVERY order of the filtered set — page after page.
   *
   * The API caps a page at 100 rows, so a full read has to walk the
   * pages. Asking for a thousand rows in one request gets a 400, and a
   * 400 inside a `forkJoin` takes the whole list down with it.
   */
  getEveryOrder(params: OrderFilterRequest = {}): Observable<OrderResponse[]> {
    const size = OrderService.MAX_PAGE_SIZE;
    return this.getAll({ ...params, page: 0, size }).pipe(
      // Walk the pages until one comes back short (the last one).
      expand((res, index) => {
        const content = res?.data?.content ?? [];
        if (content.length < size || index > 100) return EMPTY;
        return this.getAll({ ...params, page: index + 1, size });
      }),
      toArray(),
      map((pages) => pages.flatMap((p) => p?.data?.content ?? [])),
    );
  }

  /**
   * One page of orders.
   *
   * `sort` and `direction` are sent to the server — the table uses
   * `manualSorting`, so the ORDERING is the backend's, never the browser's.
   */
  getAll(params: OrderFilterRequest = {}): Observable<ApiResponse<PageResponse<OrderResponse>>> {
    // The API validates `size` and answers 400 for anything above 100
    // ("must be less than or equal to 100"), so a request that asks for
    // more than a page is a FAILED page, not a bigger one.
    const size = Math.min(params.size ?? 20, OrderService.MAX_PAGE_SIZE);
    let p = new HttpParams().set('page', params.page ?? 0).set('size', size);

    if (params.sort) p = p.set('sort', params.sort);
    if (params.direction) p = p.set('direction', params.direction);
    if (params.status) p = p.set('status', params.status);
    if (params.userId) p = p.set('userId', params.userId.toString());
    if (params.search) p = p.set('search', params.search);
    if (params.paymentStatus) p = p.set('paymentStatus', params.paymentStatus);
    if (params.paymentMethod) p = p.set('paymentMethod', params.paymentMethod);
    if (params.dateFrom) p = p.set('dateFrom', params.dateFrom);
    if (params.dateTo) p = p.set('dateTo', params.dateTo);

    return this.http.get<ApiResponse<PageResponse<OrderResponse>>>(this.base, { params: p });
  }

  /**
   * The counts of the filtered set.
   *
   * The same filters as the list, so a card can never contradict the rows
   * below it.
   */
  getStats(params: OrderFilterRequest = {}): Observable<ApiResponse<OrderStats>> {
    let p = new HttpParams();
    if (params.status) p = p.set('status', params.status);
    if (params.search) p = p.set('search', params.search);
    if (params.paymentStatus) p = p.set('paymentStatus', params.paymentStatus);
    if (params.paymentMethod) p = p.set('paymentMethod', params.paymentMethod);
    if (params.dateFrom) p = p.set('dateFrom', params.dateFrom);
    if (params.dateTo) p = p.set('dateTo', params.dateTo);

    return this.http.get<ApiResponse<OrderStats>>(`${this.base}/stats`, { params: p });
  }

  /** One order, with its items, its address and its customer. */
  getById(id: number): Observable<ApiResponse<OrderResponse>> {
    return this.http.get<ApiResponse<OrderResponse>>(`${this.base}/${id}`);
  }

  /**
   * Change an order's status.
   *
   * The note, the notify flag and the cancellation reason travel with the
   * request; the backend writes them to the history in the same transaction
   * as the change.
   */
  updateStatus(
    id: number,
    update: { status: OrderStatus; note?: string; notifyCustomer?: boolean; reason?: string },
  ): Observable<ApiResponse<OrderResponse>> {
    const body: Record<string, unknown> = { status: update.status };
    if (update.note) body['note'] = update.note;
    if (update.notifyCustomer) body['notifyCustomer'] = true;
    if (update.reason) body['reason'] = update.reason;

    return this.http.put<ApiResponse<OrderResponse>>(`${this.base}/${id}/status`, body);
  }

  /**
   * Change the status of MANY orders in ONE request (FE-18b).
   *
   * <p>Before this endpoint existed the list sent one request per row,
   * sequentially. The answer carries one result per id, in the order sent: a
   * refused or unknown order comes back as `success: false` with the server's
   * own message, so a batch is never all-or-nothing.
   *
   * <p>The customer is NOT notified from here: there is one shared note for
   * the whole batch, and the mail would quote it to every customer.
   */
  bulkUpdateStatus(
    ids: readonly number[],
    status: OrderStatus,
    note?: string,
  ): Observable<ApiResponse<BulkStatusRowResult[]>> {
    const body: { ids: number[]; status: OrderStatus; note?: string } = {
      ids: [...ids],
      status,
    };
    if (note) body.note = note;

    return this.http.put<ApiResponse<BulkStatusRowResult[]>>(`${this.base}/bulk-status`, body);
  }

  /** The status history of an order, oldest first. */
  getHistory(id: number): Observable<ApiResponse<OrderStatusHistoryEntry[]>> {
    return this.http.get<ApiResponse<OrderStatusHistoryEntry[]>>(`${this.base}/${id}/history`);
  }

  /** The internal notes of an order, newest first. */
  getNotes(id: number): Observable<ApiResponse<OrderNote[]>> {
    return this.http.get<ApiResponse<OrderNote[]>>(`${this.base}/${id}/notes`);
  }

  /** Add an internal note. */
  addNote(id: number, body: string): Observable<ApiResponse<OrderNote>> {
    return this.http.post<ApiResponse<OrderNote>>(`${this.base}/${id}/notes`, { body, internal: true });
  }

  /** The shipment of an order. */
  getShipment(id: number): Observable<ApiResponse<OrderShipment>> {
    return this.http.get<ApiResponse<OrderShipment>>(`${this.base}/${id}/shipment`);
  }

  /** Record (or change) the shipment of an order. */
  updateShipment(
    id: number,
    payload: {
      carrier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
      estimatedDeliveryAt?: string | null;
    },
  ): Observable<ApiResponse<OrderShipment>> {
    return this.http.put<ApiResponse<OrderShipment>>(`${this.base}/${id}/shipment`, payload);
  }

  /** The payment of an order, with the refunds and the net paid. */
  getPaymentDetails(id: number): Observable<ApiResponse<OrderPaymentDetails>> {
    return this.http.get<ApiResponse<OrderPaymentDetails>>(`${this.base}/${id}/payment`);
  }

  /**
   * Record a refund.
   *
   * The money is NOT returned by this call: the gateway has no refund wired
   * in, so the refund is recorded and the row says it is manual.
   */
  refund(id: number, amount: number, reason: string): Observable<ApiResponse<OrderRefund>> {
    return this.http.post<ApiResponse<OrderRefund>>(`${this.base}/${id}/refund`, { amount, reason });
  }

  /**
   * The returns of an order, newest first.
   *
   * A return is part of the order, not a module of its own: it is read with
   * the same `order:read` the rest of the page uses.
   */
  getReturns(id: number): Observable<ApiResponse<OrderReturn[]>> {
    return this.http.get<ApiResponse<OrderReturn[]>>(`${this.base}/${id}/returns`);
  }

  /**
   * Record a return: which lines came back, how many, and why.
   *
   * Recording does NOT move stock — approving does.
   */
  createReturn(id: number, payload: CreateReturnPayload): Observable<ApiResponse<OrderReturn>> {
    return this.http.post<ApiResponse<OrderReturn>>(`${this.base}/${id}/returns`, payload);
  }

  /**
   * Decide a return.
   *
   * `approve` restocks the returned units through the stock log; `reject`
   * moves nothing. Both are idempotent on the server, so a retry is safe.
   */
  decideReturn(
    id: number,
    returnId: number,
    decision: 'approve' | 'reject',
  ): Observable<ApiResponse<OrderReturn>> {
    return this.http.post<ApiResponse<OrderReturn>>(
      `${this.base}/${id}/returns/${returnId}/${decision}`,
      {},
    );
  }

  /**
   * The invoice of an order, as a PDF.
   *
   * Fetched THROUGH the authenticated HttpClient — `responseType: 'blob'` with
   * `observe: 'response'` — not through an `<a href>`: a plain link is a browser
   * navigation with no Authorization header, so it would answer 401 and the
   * admin would save an error page named "invoice.pdf". The file name comes
   * from the server's `Content-Disposition` when it is readable, and from the
   * order number otherwise.
   *
   * @param language the language of the DOCUMENT (the server draws an Arabic
   *                 invoice right-to-left when asked for `ar`)
   */
  downloadInvoice(
    id: number,
    orderNumber: string,
    language: 'en' | 'ar',
  ): Observable<{ blob: Blob; filename: string }> {
    const params = new HttpParams().set('lang', language);
    return this.http
      .get(`${this.base}/${id}/invoice`, { params, responseType: 'blob', observe: 'response' })
      .pipe(
        map((res) => ({
          blob: res.body ?? new Blob(),
          filename:
            invoiceFilenameFrom(res.headers.get('Content-Disposition')) ??
            `invoice-${orderNumber}.pdf`,
        })),
      );
  }

  /**
   * Send the order confirmation again.
   *
   * The answer carries the backend's own message and the status the mail row
   * ended in (SENT, FAILED, DEAD) — a refusal is shown as a warning, not as a
   * green toast.
   */
  resendConfirmation(id: number): Observable<ApiResponse<OrderConfirmationResend>> {
    return this.http.post<ApiResponse<OrderConfirmationResend>>(
      `${this.base}/${id}/confirmation-email`,
      {},
    );
  }

  /**
   * Everything the order page shows about what HAPPENED to the order: the
   * status history, the notes and the payment, in one round trip.
   *
   * One of the three failing must not blank the others, so each is caught
   * and the page still shows what it has.
   */
  getActivity(id: number): Observable<{
    history: OrderStatusHistoryEntry[];
    notes: OrderNote[];
    payment: OrderPaymentDetails | null;
    errors: string[];
  }> {
    const errors: string[] = [];
    const safe = <T>(source: Observable<ApiResponse<T>>, fallback: T) =>
      source.pipe(
        map((res) => res.data),
        switchMap((data) => of(data)),
        catchTo(fallback, errors),
      );

    return forkJoin({
      history: safe(this.getHistory(id), [] as OrderStatusHistoryEntry[]),
      notes: safe(this.getNotes(id), [] as OrderNote[]),
      payment: safe(this.getPaymentDetails(id), null as OrderPaymentDetails | null),
    }).pipe(map((result) => ({ ...result, errors })));
  }
}

/** A failing request must not take the whole page down with it. */
function catchTo<T>(fallback: T, errors: string[]) {
  return (source: Observable<T>) =>
    new Observable<T>((subscriber) =>
      source.subscribe({
        next: (value) => subscriber.next(value),
        error: (err) => {
          errors.push(err?.error?.message ?? 'The order activity could not be loaded');
          subscriber.next(fallback);
          subscriber.complete();
        },
        complete: () => subscriber.complete(),
      }),
    );
}
