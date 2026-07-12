import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  CoffeeVarietyResponse,
  CoffeeVarietyRequest,
  CoffeeVarietyListParams,
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
    const p: HttpParams = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<CoffeeVarietyResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }
}
