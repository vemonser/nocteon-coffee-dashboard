import { Injectable } from '@angular/core';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { BrewingMethodListParams, BrewingMethodRequest, BrewingMethodResponse } from '../models/brewing-method.model';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { HttpParams } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class BrewingMethodService extends BaseCrudService<BrewingMethodResponse, BrewingMethodRequest> {
  protected override basePath = '/api/dashboard/brewing-methods';

  getAll(params: BrewingMethodListParams = {}): Observable<ApiResponse<PageResponse<BrewingMethodResponse>>> {
    const p: HttpParams = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<BrewingMethodResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }
}
