import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ProcessingMethodResponse, ProcessingMethodRequest, ProcessingMethodListParams } from '../models/processing-method.model';
import { BaseCrudService } from '../../../core/crud/base-crud.service';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProcessingMethodService extends BaseCrudService<ProcessingMethodResponse, ProcessingMethodRequest> {
  protected override basePath = '/api/dashboard/processing-methods';

  getAll(params: ProcessingMethodListParams = {}): Observable<ApiResponse<PageResponse<ProcessingMethodResponse>>> {
    const p: HttpParams = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<ProcessingMethodResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }
}