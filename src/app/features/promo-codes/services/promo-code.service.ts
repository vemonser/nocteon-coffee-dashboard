import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { PromoCodeAnalyticsResponse, PromoCodeRequest, PromoCodeResponse } from '../models/promo-code.model';
import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PromoCodeService extends BaseCrudService<PromoCodeResponse, PromoCodeRequest, number> {
  protected override basePath = '/api/dashboard/promo-codes';

  getAll(params: BaseListParams = {}): Observable<ApiResponse<PageResponse<PromoCodeResponse>>> {
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<PromoCodeResponse>>>(this.fullUrl, { params: p });
  }
  getById(id: number): Observable<ApiResponse<PromoCodeResponse>> {
    return this.http.get<ApiResponse<PromoCodeResponse>>(
      `${environment.apiUrl}/api/dashboard/promo-codes/${id}`,
    )
      // ${this.fullUrl}/${id}`);
  }

  getAnalytics(days = 30): Observable<ApiResponse<PromoCodeAnalyticsResponse>> {
    return this.http.get<ApiResponse<PromoCodeAnalyticsResponse>>(
      `${this.fullUrl}/analytics`,
      { params: new HttpParams().set('days', days) },
    );
  }
}
