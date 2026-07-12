import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { FarmRequest, FarmResponse } from '../models/farm.model';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';

// features/farms/services/farm.service.ts
export interface FarmListParams extends BaseListParams {
  originSlug?: string;    // filter by parent origin
}
 
@Injectable({ providedIn: 'root' })
export class FarmService extends BaseCrudService<FarmResponse, FarmRequest> {
  protected override basePath = '/api/dashboard/farms';
 
  getAll(params: FarmListParams = {}): Observable<ApiResponse<PageResponse<FarmResponse>>> {
    let p: HttpParams = this.buildBaseParams(params);
    if (params.originSlug) p = p.set('originSlug', params.originSlug);
    return this.http.get<ApiResponse<PageResponse<FarmResponse>>>(
      `${environment.apiUrl}${this.basePath}`, { params: p });
  }
  // Farm HAS image → base buildFormData already handles the multipart upload
  // create / update / delete → all inherited, no need to override
}
 