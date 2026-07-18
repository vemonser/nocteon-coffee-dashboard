import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { CartResponse } from '../models/cart.model';

export interface CartListParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: string;
}

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
export class CartService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/carts`;

  getAll(params: CartListParams = {}): Observable<ApiResponse<PageResponse<CartResponse>>> {
    let p = new HttpParams().set('page', params.page ?? 0).set('size', params.size ?? 20);

    if (params.sort) p = p.set('sort', params.sort);
    if (params.direction) p = p.set('direction', params.direction);

    return this.http
      .get<ApiResponse<SpringPage<CartResponse>>>(this.base, { params: p })
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

  getById(id: number): Observable<ApiResponse<CartResponse>> {
    return this.http.get<ApiResponse<CartResponse>>(`${this.base}/${id}`);
  }
}
