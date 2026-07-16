import { Injectable } from '@angular/core';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { PromoCodeRequest, PromoCodeResponse } from '../models/promo-code.model';
import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PromoCodeService extends BaseCrudService<PromoCodeResponse, PromoCodeRequest> {
  protected override basePath = '/api/dashboard/promo-codes';

  getAll(params: BaseListParams = {}): Observable<ApiResponse<PageResponse<PromoCodeResponse>>> {
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<PromoCodeResponse>>>(this.fullUrl, { params: p });
  }
  getById(id: string): Observable<ApiResponse<PromoCodeResponse>> {
    return this.http.get<ApiResponse<PromoCodeResponse>>(
      `${environment.apiUrl}/api/dashboard/promo-codes/${id}`,
    )
      // ${this.fullUrl}/${id}`);
  }
}
