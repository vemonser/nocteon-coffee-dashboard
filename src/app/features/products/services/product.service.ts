import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
  ProductDetail,
  ProductListItem,
  ProductListParams,
  ProductRequest,
} from '../models/product.models';
import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/products`;

  getAll(params: ProductListParams = {}): Observable<ApiResponse<PageResponse<ProductListItem>>> {
    let p = new HttpParams().set('page', params.page ?? 0).set('size', params.size ?? 20);

    if (params.search) p = p.set('search', params.search);
    if (params.categorySlug) p = p.set('categorySlug', params.categorySlug);
    if (params.productType) p = p.set('productType', params.productType);
    if (params.isActive !== undefined) p = p.set('isActive', params.isActive);
    if (params.featured !== undefined) p = p.set('featured', params.featured);
    if (params.sort) p = p.set('sort', params.sort);
    if (params.direction) p = p.set('direction', params.direction);

    return this.http.get<ApiResponse<PageResponse<ProductListItem>>>(this.base, { params: p });
  }

  getBySlug(slug: string): Observable<ApiResponse<ProductDetail>> {
    return this.http.get<ApiResponse<ProductDetail>>(`${this.base}/${slug}`);
  }

  create(data: ProductRequest, mediaFiles: File[] = []): Observable<ApiResponse<ProductDetail>> {
    const fd = this.buildFormData(data, mediaFiles);
    return this.http.post<ApiResponse<ProductDetail>>(this.base, fd);
  }

  update(
    slug: string,
    data: ProductRequest,
    mediaFiles: File[] = [],
  ): Observable<ApiResponse<ProductDetail>> {
    const fd = this.buildFormData(data, mediaFiles);
    return this.http.put<ApiResponse<ProductDetail>>(`${this.base}/${slug}`, fd);
  }

  delete(slug: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.base}/${slug}`);
  }
  toggleActive(slug: string, isActive: boolean): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.base}/${slug}/active`, { isActive });
  }

  toggleFeatured(slug: string, featured: boolean): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.base}/${slug}/featured`, { featured });
  }

  private buildFormData(data: ProductRequest, mediaFiles: File[]): FormData {
    const formData = new FormData();

    formData.append('request', new Blob([JSON.stringify(data)], { type: 'application/json' }));

    mediaFiles.forEach((file) => {
      formData.append('files', file);
    });

    return formData;
  }
}
