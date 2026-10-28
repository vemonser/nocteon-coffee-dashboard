import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { ProductTag, ProductTagRequest } from '../models/product-tag.model';

/**
 * FE-10: the tag vocabulary the product form assigns and the products list filters by.
 *
 * The list is small and read by three screens, so it is returned whole rather than paged.
 */
@Injectable({ providedIn: 'root' })
export class ProductTagService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/product-tags`;

  getAll(): Observable<ApiResponse<ProductTag[]>> {
    return this.http.get<ApiResponse<ProductTag[]>>(this.base);
  }

  create(request: ProductTagRequest): Observable<ApiResponse<ProductTag>> {
    return this.http.post<ApiResponse<ProductTag>>(this.base, request);
  }

  rename(id: number, request: ProductTagRequest): Observable<ApiResponse<ProductTag>> {
    return this.http.put<ApiResponse<ProductTag>>(`${this.base}/${id}`, request);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.base}/${id}`);
  }
}
