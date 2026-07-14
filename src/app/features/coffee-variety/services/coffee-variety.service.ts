import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  CoffeeVarietyResponse,
  CoffeeVarietyRequest,
  CoffeeVarietyListParams,
  DashboardCoffeeVarietyResponse,
} from '../models/coffee-variety.model';
import { BaseCrudService } from '../../../core/crud/base-crud.service';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CoffeeVarietyService extends BaseCrudService<
  CoffeeVarietyResponse,
  CoffeeVarietyRequest
> {
  protected override basePath = '/api/dashboard/coffee-varieties';

  getAll(
    params: CoffeeVarietyListParams = {},
  ): Observable<ApiResponse<PageResponse<CoffeeVarietyResponse>>> {
    let p: HttpParams = this.buildBaseParams(params);

    return this.http.get<ApiResponse<PageResponse<CoffeeVarietyResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }

  getBySlug(slug: string): Observable<ApiResponse<CoffeeVarietyResponse>> {
    return this.http.get<ApiResponse<CoffeeVarietyResponse>>(
      `${environment.apiUrl}/api/coffee-varieties/${slug}`,
    );
  }

  getDashboardBySlug(slug: string): Observable<ApiResponse<DashboardCoffeeVarietyResponse>> {
    return this.http.get<ApiResponse<DashboardCoffeeVarietyResponse>>(
      `${environment.apiUrl}/api/dashboard/coffee-varieties/${slug}`,
    );
  }

  override update(
    slug: string,
    data: CoffeeVarietyRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'multipart',
  ): Observable<ApiResponse<DashboardCoffeeVarietyResponse>> {
    return this.http.put<ApiResponse<DashboardCoffeeVarietyResponse>>(
      `${this.fullUrl}/${slug}`,
      this.buildRequestBody(data, image, format),
    );
  }
}
