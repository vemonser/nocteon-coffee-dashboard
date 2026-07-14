import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { FarmRequest, FarmResponse, DashboardFarmResponse, ProductCardResponse } from '../models/farm.model';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FarmService extends BaseCrudService<FarmResponse, FarmRequest> {
  protected override basePath = '/api/dashboard/farms';

  getAll(params: BaseListParams = {}): Observable<ApiResponse<PageResponse<FarmResponse>>> {
    const p: HttpParams = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<FarmResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }

  getDashboardBySlug(slug: string): Observable<ApiResponse<DashboardFarmResponse>> {
    return this.http.get<ApiResponse<DashboardFarmResponse>>(
      `${environment.apiUrl}/api/dashboard/farms/${slug}`,
    );
  }

  override update(
    slug: string,
    data: FarmRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'multipart',
  ): Observable<ApiResponse<DashboardFarmResponse>> {
    return this.http.put<ApiResponse<DashboardFarmResponse>>(
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
      `${environment.apiUrl}/api/farms/${slug}/products`,
      { params: p },
    );
  }
}