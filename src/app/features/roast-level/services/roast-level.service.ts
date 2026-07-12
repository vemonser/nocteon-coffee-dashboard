import { Injectable } from '@angular/core';

import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';

import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { RoastLevelRequest, RoastLevelResponse } from '../models/roast-level.model';

@Injectable({ providedIn: 'root' })
export class RoastLevelService extends BaseCrudService<
  RoastLevelResponse,
  RoastLevelRequest
> {
  protected override basePath = '/api/dashboard/roast-levels';

  getAll(params: BaseListParams = {}): Observable<ApiResponse<PageResponse<RoastLevelResponse>>> {
    // No extra filters — pure base params
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<RoastLevelResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }
}
