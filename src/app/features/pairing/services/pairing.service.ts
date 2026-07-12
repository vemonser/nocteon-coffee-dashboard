
import { Injectable } from '@angular/core';
import {  HttpParams } from '@angular/common/http';

import { Observable } from 'rxjs';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { PairingRequest,PairingResponse } from '../models/pairing.model';
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
}
 