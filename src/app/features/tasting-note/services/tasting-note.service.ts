import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';

import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';

import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import {
  TastingNoteRequest,
  TastingNoteResponse,
  DashboardTastingNoteResponse,
} from '../models/tasting-note.model';

@Injectable({ providedIn: 'root' })
export class TastingNoteService extends BaseCrudService<
  TastingNoteResponse,
  TastingNoteRequest
> {
  protected override basePath = '/api/dashboard/tasting-notes';

  getAll(params: BaseListParams = {}): Observable<ApiResponse<PageResponse<TastingNoteResponse>>> {
    // No extra filters — pure base params
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<TastingNoteResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p },
    );
  }

  getBySlug(slug: string): Observable<ApiResponse<TastingNoteResponse>> {
    return this.http.get<ApiResponse<TastingNoteResponse>>(
      `${environment.apiUrl}/api/tasting-notes/${slug}`,
    );
  }

  getDashboardBySlug(slug: string): Observable<ApiResponse<DashboardTastingNoteResponse>> {
    return this.http.get<ApiResponse<DashboardTastingNoteResponse>>(
      `${environment.apiUrl}/api/dashboard/tasting-notes/${slug}`,
    );
  }

  override update(
    slug: string,
    data: TastingNoteRequest,
    image?: File,
    format: 'auto' | 'json' | 'multipart' = 'json',
  ): Observable<ApiResponse<DashboardTastingNoteResponse>> {
    return this.http.put<ApiResponse<DashboardTastingNoteResponse>>(
      `${this.fullUrl}/${slug}`,
      this.buildRequestBody(data, image, format),
    );
  }
}
