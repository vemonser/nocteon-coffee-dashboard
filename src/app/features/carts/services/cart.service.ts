import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { CartResponse, CartStatsResponse, CartListParams } from '../models/cart.model';

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
    if (params.status) p = p.set('status', params.status);
    if (params.from) p = p.set('from', params.from);
    if (params.to) p = p.set('to', params.to);

    return this.http.get<ApiResponse<PageResponse<CartResponse>>>(this.base, { params: p });
  }

  getById(id: number): Observable<ApiResponse<CartResponse>> {
    return this.http.get<ApiResponse<CartResponse>>(`${this.base}/${id}`);
  }

  getStats(): Observable<ApiResponse<CartStatsResponse>> {
    return this.http.get<ApiResponse<CartStatsResponse>>(`${this.base}/stats`);
  }

  sendReminder(id: number): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.base}/${id}/remind`, {});
  }
}