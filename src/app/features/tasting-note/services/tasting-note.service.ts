import { Injectable } from '@angular/core';

import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';

import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { TastingNoteRequest,TastingNoteResponse } from '../models/tasting-note.model';

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
}
