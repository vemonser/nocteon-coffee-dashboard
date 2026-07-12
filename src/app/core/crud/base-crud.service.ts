import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

export interface BaseListParams {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export abstract class BaseCrudService<TResponse, TRequest> {
  protected readonly http = inject(HttpClient);
  protected abstract basePath: string;

  protected get fullUrl(): string {
    return `${environment.apiUrl}${this.basePath}`;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  protected buildBaseParams(params: BaseListParams): HttpParams {
    let httpParams = new HttpParams()
      .set('page', params.page ?? 0)
      .set('size', params.size ?? 20);

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
    formData.append(
      'data',
      new Blob([JSON.stringify(data)], { type: 'application/json' })
    );
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
    format: 'auto' | 'json' | 'multipart' = 'auto'
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
    format: 'auto' | 'json' | 'multipart' = 'auto'
  ): Observable<ApiResponse<TResponse>> {
    return this.http.post<ApiResponse<TResponse>>(
      this.fullUrl,
      this.buildRequestBody(data, image, format)
    );
  }

  update(
    slug: string,
    data: TRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'auto'
  ): Observable<ApiResponse<TResponse>> {
    return this.http.put<ApiResponse<TResponse>>(
      `${this.fullUrl}/${slug}`,
      this.buildRequestBody(data, image, format)
    );
  }

  delete(slug: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.fullUrl}/${slug}`);
  }
}