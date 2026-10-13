import { Injectable } from '@angular/core';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { BroadcastRequest, BroadcastResponse } from '../models/broadcast.model';
import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class BroadcastService extends BaseCrudService<BroadcastResponse, BroadcastRequest> {
  protected override basePath = '/api/dashboard/broadcasts';

  getAll(params: BaseListParams = {}): Observable<ApiResponse<PageResponse<BroadcastResponse>>> {
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<BroadcastResponse>>>(this.fullUrl, { params: p });
  }

  getById(id: string): Observable<ApiResponse<BroadcastResponse>> {
    return this.http.get<ApiResponse<BroadcastResponse>>(`${this.fullUrl}/${id}`);
  }
}