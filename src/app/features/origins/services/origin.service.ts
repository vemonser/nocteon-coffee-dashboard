import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import {
  OriginRequest,
  OriginResponse,
  DashboardOriginResponse,
  ProductCardResponse,
  OriginOption,
} from '../models/origin.model';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OriginService extends BaseCrudService<OriginResponse, OriginRequest> {
  protected override basePath = '/api/dashboard/origins';

  getAll(params: BaseListParams = {}): Observable<ApiResponse<PageResponse<OriginResponse>>> {
    const p: HttpParams = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<OriginResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }

  getDashboardBySlug(slug: string): Observable<ApiResponse<DashboardOriginResponse>> {
    return this.http.get<ApiResponse<DashboardOriginResponse>>(
      `${environment.apiUrl}/api/dashboard/origins/${slug}`,
    );
  }

  override update(
    slug: string,
    data: OriginRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'multipart',
  ): Observable<ApiResponse<DashboardOriginResponse>> {
    return this.http.put<ApiResponse<DashboardOriginResponse>>(
      `${this.fullUrl}/${slug}`,
      this.buildRequestBody(data, image, format),
    );
  }
  getAllOptions(): Observable<ApiResponse<OriginOption[]>> {
    return this.http.get<ApiResponse<OriginOption[]>>(
      `${environment.apiUrl}/api/dashboard/origins/options`,
    );
  }
  getProducts(
    slug: string,
    params: BaseListParams = {},
  ): Observable<ApiResponse<PageResponse<ProductCardResponse>>> {
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<ProductCardResponse>>>(
      `${environment.apiUrl}/api/origins/${slug}/products`,
      { params: p },
    );
  }
}
