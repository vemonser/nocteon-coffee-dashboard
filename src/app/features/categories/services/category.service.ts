import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { CategoryRequest, CategoryResponse, DashboardCategoryResponse, ProductCardResponse } from '../models/category.model';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

export interface CategoryListParams extends BaseListParams {
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CategoryService extends BaseCrudService<CategoryResponse, CategoryRequest> {
  protected override basePath = '/api/dashboard/categories';

  getAll(params: CategoryListParams = {}): Observable<ApiResponse<PageResponse<CategoryResponse>>> {
    let p: HttpParams = this.buildBaseParams(params);
    if (params.isActive !== undefined) p = p.set('isActive', params.isActive);

    return this.http.get<ApiResponse<PageResponse<CategoryResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }

  getBySlug(slug: string): Observable<ApiResponse<CategoryResponse>> {
    return this.http.get<ApiResponse<CategoryResponse>>(
      `${environment.apiUrl}/api/categories/${slug}`,
    );
  }

  getDashboardBySlug(slug: string): Observable<ApiResponse<DashboardCategoryResponse>> {
    return this.http.get<ApiResponse<DashboardCategoryResponse>>(
      `${environment.apiUrl}/api/dashboard/categories/${slug}`,
    );
  }

  /**
   * Overrides the base `update()` because the dashboard edit endpoint
   * returns DashboardCategoryResponse (all translations), not CategoryResponse
   * (single locale) — matching the backend change in CategoryController/Service.
   */
  override update(
    slug: string,
    data: CategoryRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'multipart',
  ): Observable<ApiResponse<DashboardCategoryResponse>> {
    return this.http.put<ApiResponse<DashboardCategoryResponse>>(
      `${this.fullUrl}/${slug}`,
      this.buildRequestBody(data, image, format),
    );
  }

  getProducts(
    slug: string,
    params: BaseListParams = {},
  ): Observable<ApiResponse<PageResponse<ProductCardResponse>>> {
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<ProductCardResponse>>>(
      `${environment.apiUrl}/api/categories/${slug}/products`,
      { params: p },
    );
  }
}