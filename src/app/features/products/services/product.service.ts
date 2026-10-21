import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import {
  ProductDetail,
  ProductListItem,
  ProductListParams,
  ProductMediaRequest,
  ProductRequest,
} from '../models/product.models';
import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/products`;

  /** The biggest page the API accepts (`size` is validated, max 100). */
  private static readonly MAX_PAGE_SIZE = 100;

  getAll(params: ProductListParams = {}): Observable<ApiResponse<PageResponse<ProductListItem>>> {
    // The API validates `size` and answers 400 for anything above 100
    // ("must be less than or equal to 100"), so a request that asks for
    // more than a page is a FAILED page, not a bigger one. The product
    // service does not extend the base CRUD service, so the cap is
    // applied here.
    const size = Math.min(params.size ?? 20, ProductService.MAX_PAGE_SIZE);
    let p = new HttpParams().set('page', params.page ?? 0).set('size', size);

    if (params.search) p = p.set('search', params.search);
    if (params.categorySlug) p = p.set('categorySlug', params.categorySlug);
    if (params.originSlug) p = p.set('originSlug', params.originSlug);
    if (params.farmSlug) p = p.set('farmSlug', params.farmSlug);
    if (params.productType) p = p.set('productType', params.productType);
    if (params.isActive !== undefined) p = p.set('isActive', params.isActive);
    if (params.featured !== undefined) p = p.set('featured', params.featured);
    if (params.inStockOnly) p = p.set('inStockOnly', 'true');
    if (params.onSaleOnly) p = p.set('onSaleOnly', 'true');
    if (params.minPrice !== undefined) p = p.set('minPrice', params.minPrice);
    if (params.maxPrice !== undefined) p = p.set('maxPrice', params.maxPrice);
    if (params.minRating !== undefined) p = p.set('minRating', params.minRating);
    if (params.brewingMethodSlug) p = p.set('brewingMethodSlug', params.brewingMethodSlug);
    if (params.optionValueIds?.length) {
      params.optionValueIds.forEach((id) => p = p.append('optionValueIds', id));
    }
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

  getDeleted(params: ProductListParams = {}): Observable<ApiResponse<PageResponse<any>>> {
    let p = new HttpParams().set('page', params.page ?? 0).set('size', params.size ?? 20);
    if (params.search) p = p.set('search', params.search);
    if (params.sort) p = p.set('sort', params.sort);
    if (params.direction) p = p.set('direction', params.direction);
    return this.http.get<ApiResponse<PageResponse<ProductListItem>>>(`${this.base}/deleted`, { params: p });
  }

  restore(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.base}/${id}/restore`, null);
  }

  deletePermanently(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/permanent`);
  }
  toggleActive(slug: string, isActive: boolean): Observable<ApiResponse<void>> {
    const params = new HttpParams().set('value', isActive);
    return this.http.patch<ApiResponse<void>>(`${this.base}/${slug}/active`, null, { params });
  }

  toggleFeatured(slug: string, featured: boolean): Observable<ApiResponse<void>> {
    const params = new HttpParams().set('value', featured);
    return this.http.patch<ApiResponse<void>>(`${this.base}/${slug}/featured`, null, { params });
  }

  /** POST /media — attach new media files to an existing product. */
  addMedia(
    slug: string,
    media: ProductMediaRequest[],
    files: File[],
  ): Observable<ApiResponse<void>> {
    const fd = new FormData();
    fd.append('media', new Blob([JSON.stringify(media)], { type: 'application/json' }));
    files.forEach((file) => fd.append('files', file));
    return this.http.post<ApiResponse<void>>(`${this.base}/${slug}/media`, fd);
  }

  /** DELETE /media/{mediaId} — remove a product media record. */
  deleteMedia(mediaId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.base}/media/${mediaId}`);
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
