import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  ProcessingMethodResponse,
  ProcessingMethodRequest,
  ProcessingMethodListParams,
  DashboardProcessingMethodResponse,
} from '../models/processing-method.model';
import { BaseCrudService } from '../../../core/crud/base-crud.service';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProcessingMethodService extends BaseCrudService<
  ProcessingMethodResponse,
  ProcessingMethodRequest
> {
  protected override basePath = '/api/dashboard/processing-methods';

  getAll(
    params: ProcessingMethodListParams = {},
  ): Observable<ApiResponse<PageResponse<ProcessingMethodResponse>>> {
    const p: HttpParams = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<ProcessingMethodResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }

  getBySlug(slug: string): Observable<ApiResponse<ProcessingMethodResponse>> {
    return this.http.get<ApiResponse<ProcessingMethodResponse>>(
      `${environment.apiUrl}/api/processing-methods/${slug}`,
    );
  }

  getDashboardBySlug(slug: string): Observable<ApiResponse<DashboardProcessingMethodResponse>> {
    return this.http.get<ApiResponse<DashboardProcessingMethodResponse>>(
      `${environment.apiUrl}/api/dashboard/processing-methods/${slug}`,
    );
  }

  override update(
    slug: string,
    data: ProcessingMethodRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'json',
  ): Observable<ApiResponse<DashboardProcessingMethodResponse>> {
    return this.http.put<ApiResponse<DashboardProcessingMethodResponse>>(
      `${this.fullUrl}/${slug}`,
      this.buildRequestBody(data, image, format),
    );
  }
}
