import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseCrudService } from '../../../core/crud/base-crud.service';
import { StoreSetting, StoreSettingResponse } from '../models/store-settings.model';
import { ApiResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StoreSettingService extends BaseCrudService<StoreSettingResponse, StoreSetting> {
  protected override basePath = '/api/settings';

  /** GET /api/settings — returns the single store settings object. */
  get(): Observable<ApiResponse<StoreSettingResponse>> {
    return this.http.get<ApiResponse<StoreSettingResponse>>(
      `${environment.apiUrl}/api/settings`,
    );
  }

  /** PUT /api/dashboard/settings — singleton update (no slug). */
  override update(
    slug: string,
    data: StoreSetting,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'json',
  ): Observable<ApiResponse<StoreSettingResponse>> {
    return this.http.put<ApiResponse<StoreSettingResponse>>(
      `${environment.apiUrl}/api/dashboard/settings`,
      this.buildRequestBody(data, image, format),
    );
  }
}
