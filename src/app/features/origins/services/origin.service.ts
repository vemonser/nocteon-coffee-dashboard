import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { OriginRequest, OriginResponse } from '../models/origin.model';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';

export interface OriginListParams extends BaseListParams {
  // No extra filters for origins — base params are enough
}

@Injectable({ providedIn: 'root' })
export class OriginService extends BaseCrudService<OriginResponse, OriginRequest> {
  protected override basePath = '/api/dashboard/origins';

  getAll(params: OriginListParams = {}): Observable<ApiResponse<PageResponse<OriginResponse>>> {
    // Origins have no extra filters — base params cover everything
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<OriginResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }
 
  getAllOptions(): Observable<ApiResponse<PageResponse<OriginResponse>>> {
    const p = this.buildBaseParams({ page: 0, size: 200, sort: 'createdAt', direction: 'asc' });
    return this.http.get<ApiResponse<PageResponse<OriginResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }

}