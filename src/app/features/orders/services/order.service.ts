import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { OrderFilterRequest, OrderResponse, OrderStatus } from '../models/order.model';

interface SpringPage<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/orders`;

  getAll(params: OrderFilterRequest = {}): Observable<ApiResponse<PageResponse<OrderResponse>>> {
    let p = new HttpParams().set('page', params.page ?? 0).set('size', params.size ?? 20);

    if (params.sort) p = p.set('sort', params.sort);
    if (params.direction) p = p.set('direction', params.direction);
    if (params.status) p = p.set('status', params.status);
    if (params.userId) p = p.set('userId', params.userId.toString());
    if (params.search) p = p.set('search', params.search);

    return this.http.get<ApiResponse<PageResponse<OrderResponse>>>(this.base, { params: p });
  }

  updateStatus(id: number, status: OrderStatus): Observable<ApiResponse<OrderResponse>> {
    return this.http.put<ApiResponse<OrderResponse>>(`${this.base}/${id}/status`, { status });
  }

  getById(id: number): Observable<ApiResponse<OrderResponse>> {
    // `{$id}` (a typo, not an interpolation) sent GET /orders/{$id} — the order
    // detail page could never load, which is why it stayed unrouted.
    return this.http.get<ApiResponse<OrderResponse>>(`${this.base}/${id}`);
  }
}
