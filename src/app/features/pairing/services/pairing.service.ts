import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { DashboardPairingResponse, PairingRequest, PairingResponse } from '../models/pairing.model';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

export interface PairingListParams extends BaseListParams {
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PairingService extends BaseCrudService<PairingResponse, PairingRequest> {
  protected override basePath = '/api/dashboard/pairings';

  getAll(params: PairingListParams = {}): Observable<ApiResponse<PageResponse<PairingResponse>>> {
    let p: HttpParams = this.buildBaseParams(params);

    return this.http.get<ApiResponse<PageResponse<PairingResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }
  getBySlug(slug: string): Observable<ApiResponse<PairingResponse>> {
    return this.http.get<ApiResponse<PairingResponse>>(
      `${environment.apiUrl}/api/pairings/${slug}`,
    );
  }

  getDashboardBySlug(slug: string): Observable<ApiResponse<DashboardPairingResponse>> {
    return this.http.get<ApiResponse<DashboardPairingResponse>>(
      `${environment.apiUrl}/api/dashboard/pairings/${slug}`,
    );
  }


  override update(
    slug: string,
    data: PairingRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'multipart',
  ): Observable<ApiResponse<DashboardPairingResponse>> {
    return this.http.put<ApiResponse<DashboardPairingResponse>>(
      `${this.fullUrl}/${slug}`,
      this.buildRequestBody(data, image, format),
    );
  }
}
