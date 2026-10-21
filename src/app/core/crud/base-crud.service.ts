import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from '../models/api-response.model';

export interface BaseListParams {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export abstract class BaseCrudService<TResponse, TRequest, TId = string> {
  protected readonly http = inject(HttpClient);
  protected abstract basePath: string;

  /**
   * The biggest page the API accepts.
   *
   * Every dashboard list endpoint validates `size` and answers **400**
   * ("must be less than or equal to 100") for anything bigger — one
   * shared cap, verified against every list endpoint. A request that
   * asks for more is not a bigger page, it is a failed page.
   *
   * So the size is clamped here, once, and a caller that needs MORE
   * rows than a page has to walk the pages (see `getEvery*`).
   */
  protected static readonly MAX_PAGE_SIZE = 100;

  protected get fullUrl(): string {
    return `${environment.apiUrl}${this.basePath}`;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  protected buildBaseParams(params: BaseListParams): HttpParams {
    const size = Math.min(params.size ?? 20, BaseCrudService.MAX_PAGE_SIZE);
    let httpParams = new HttpParams().set('page', params.page ?? 0).set('size', size);

    if (params.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }
    if (params.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }
    if (params.direction) {
      httpParams = httpParams.set('direction', params.direction);
    }

    return httpParams;
  }

  protected buildFormData(data: TRequest, image?: File): FormData {
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (image) {
      formData.append('image', image);
    }
    return formData;
  }

  /**
   * Determines request format:
   * - 'auto' (default): multipart if image exists, else JSON
   * - 'json': always JSON
   * - 'multipart': always multipart (with or without image)
   */
  protected buildRequestBody(
    data: TRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'auto',
  ): TRequest | FormData {
    switch (format) {
      case 'json':
        return data;
      case 'multipart':
        return this.buildFormData(data, image);
      case 'auto':
      default:
        return image ? this.buildFormData(data, image) : data;
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  create(
    data: TRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'auto',
  ): Observable<ApiResponse<TResponse>> {
    return this.http.post<ApiResponse<TResponse>>(
      this.fullUrl,
      this.buildRequestBody(data, image, format),
    );
  }

  // ─── Soft delete ─────────────────────────────────────────────────────────────
  //
  // The backend exposes soft delete as a SEPARATE list endpoint rather than a
  // `deleted` filter on the main one (verified: BaseFilterRequest/LookupFilterRequest
  // carry only page/size/sort/direction/search/isActive), and every entity that
  // supports it follows the same two conventions:
  //
  //   GET   /api/dashboard/<entity>/deleted?page&size&search&sort&direction
  //   PATCH /api/dashboard/<entity>/{id}/restore
  //
  // so both live here once and every soft-deletable service inherits them.
  //
  // Not implemented on purpose: `DELETE .../permanent`. No such endpoint exists
  // anywhere in the API today (see SoftDeleteContract for the exact gap), so the
  // capability surfaces it as unavailable instead of inventing a route.

  /** Trashed rows. `PageResponse.totalElements` carries the trash count. */
  getDeleted(params: BaseListParams = {}): Observable<ApiResponse<PageResponse<TResponse>>> {
    return this.http.get<ApiResponse<PageResponse<TResponse>>>(`${this.fullUrl}/deleted`, {
      params: this.buildBaseParams(params),
    });
  }

  /**
   * Un-delete by numeric id.
   *
   * Fails with 404 when the id is live or unknown, and 409
   * (`error.duplicate.slug`) when a new item took the slug while this one was in
   * the trash — callers must surface that conflict rather than retry blindly.
   */
  restore(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.fullUrl}/${id}/restore`, null);
  }

  update(
    id: TId,
    data: TRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'auto',
  ): Observable<ApiResponse<TResponse>> {
    return this.http.put<ApiResponse<TResponse>>(
      `${this.fullUrl}/${id}`,
      this.buildRequestBody(data, image, format),
    );
  }

  delete(id: TId): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.fullUrl}/${id}`);
  }

  /**
   * Permanent (hard) delete — backend contract, verified:
   *   DELETE /api/dashboard/{entity}/{id}/permanent → 204 No Content (no body).
   * Requires the row to already be trashed; 404 if not, 409 if referenced.
   */
  deletePermanently(id: number): Observable<void> {
    return this.http.delete<void>(`${this.fullUrl}/${id}/permanent`);
  }
}
