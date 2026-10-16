import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
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

    return this.http
      .get<ApiResponse<SpringPage<OrderResponse>>>(this.base, { params: p })
      .pipe(
        map((res) => ({
          ...res,
          data: {
            content: res.data.content,
            page: res.data.number,
            size: res.data.size,
            totalElements: res.data.totalElements,
            totalPages: res.data.totalPages,
            first: res.data.first,
            last: res.data.last,
          },
        })),
      );
  }

  updateStatus(id: number, status: OrderStatus): Observable<ApiResponse<OrderResponse>> {
    return this.http.put<ApiResponse<OrderResponse>>(`${this.base}/${id}/status`, { status });
  }

  getById(id: number): Observable<ApiResponse<OrderResponse>> {
    return this.http.get<ApiResponse<OrderResponse>>(`${this.base}/{$id}`);
  }
}
