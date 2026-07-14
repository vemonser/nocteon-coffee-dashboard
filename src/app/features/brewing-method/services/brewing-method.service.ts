import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import {
  BrewingMethodRequest,
  BrewingMethodResponse,
  DashboardBrewingMethodResponse,
  ProductWithScoreResponse,
} from '../models/brewing-method.model';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BrewingMethodService extends BaseCrudService<
  BrewingMethodResponse,
  BrewingMethodRequest
> {
  protected override basePath = '/api/dashboard/brewing-methods';

  getAll(
    params: BaseListParams = {},
  ): Observable<ApiResponse<PageResponse<DashboardBrewingMethodResponse>>> {
    const p: HttpParams = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<DashboardBrewingMethodResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }

  getBySlug(slug: string): Observable<ApiResponse<BrewingMethodResponse>> {
    return this.http.get<ApiResponse<BrewingMethodResponse>>(
      `${environment.apiUrl}/api/brewing-methods/${slug}`,
    );
  }

  getDashboardBySlug(slug: string): Observable<ApiResponse<DashboardBrewingMethodResponse>> {
    return this.http.get<ApiResponse<DashboardBrewingMethodResponse>>(
      `${environment.apiUrl}/api/dashboard/brewing-methods/${slug}`,
    );
  }
override update(
  slug: string,
  data: BrewingMethodRequest,
  image?: File,
  format: 'auto' | 'json' | 'multipart' = 'json',
): Observable<ApiResponse<DashboardBrewingMethodResponse>> {
  return this.http.put<ApiResponse<DashboardBrewingMethodResponse>>(
    `${this.fullUrl}/${slug}`,
    this.buildRequestBody(data, image, format),
  );
}
  // مفيش override لـ update() خالص — الـ base class كفاية
  // لأن backend بيرجع BrewingMethodResponse زي ما الـ generic متعرف عليه من الأول

  getProducts(
    slug: string,
    params: BaseListParams = {},
  ): Observable<ApiResponse<PageResponse<ProductWithScoreResponse>>> {
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<ProductWithScoreResponse>>>(
      `${environment.apiUrl}/api/dashboard/brewing-methods/${slug}/products`,
      { params: p },
    );
  }
}
