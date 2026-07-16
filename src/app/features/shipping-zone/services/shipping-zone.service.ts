import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';

import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';

import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import {
  ShippingZoneRequest,
  ShippingZoneResponse,
} from '../models/shipping-zone.model';

@Injectable({ providedIn: 'root' })
export class ShippingZoneService extends BaseCrudService<
  ShippingZoneResponse,
  ShippingZoneRequest
> {
  protected override basePath = '/api/dashboard/shipping-zones';

  getAll(params: BaseListParams = {}): Observable<ApiResponse<PageResponse<ShippingZoneResponse>>> {
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<ShippingZoneResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }

  getById(id: number | string): Observable<ApiResponse<ShippingZoneResponse>> {
    return this.http.get<ApiResponse<ShippingZoneResponse>>(
      `${environment.apiUrl}/api/dashboard/shipping-zones/${id}`,
    );
  }
}
