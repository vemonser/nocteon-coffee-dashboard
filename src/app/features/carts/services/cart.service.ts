import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { CartResponse } from '../models/cart.model';

export interface CartListParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: string;
  search?: string;
  hasItems?: boolean;
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

    if (params.search?.trim()) p = p.set('search', params.search.trim());
    if (params.hasItems !== undefined) p = p.set('hasItems', params.hasItems);
    if (params.sort) p = p.set('sort', params.sort);
    if (params.direction) p = p.set('direction', params.direction);

    return this.http.get<ApiResponse<PageResponse<CartResponse>>>(this.base, { params: p });
  }

  getById(id: number): Observable<ApiResponse<CartResponse>> {
    return this.http.get<ApiResponse<CartResponse>>(`${this.base}/${id}`);
  }
}
