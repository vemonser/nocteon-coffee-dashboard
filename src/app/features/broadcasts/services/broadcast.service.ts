import { Injectable } from '@angular/core';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { BroadcastRequest, BroadcastResponse } from '../models/broadcast.model';
import { EMPTY, Observable, expand, toArray } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class BroadcastService extends BaseCrudService<BroadcastResponse, BroadcastRequest> {
  protected override basePath = '/api/dashboard/broadcasts';

  getAll(params: BaseListParams = {}): Observable<ApiResponse<PageResponse<BroadcastResponse>>> {
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<BroadcastResponse>>>(this.fullUrl, { params: p });
  }

  getById(id: string): Observable<ApiResponse<BroadcastResponse>> {
    return this.http.get<ApiResponse<BroadcastResponse>>(`${this.fullUrl}/${id}`);
  }

  /**
   * EVERY broadcast, page after page.
   *
   * The API caps a page at 100 rows (a bigger `size` is a 400), so an
   * export that asks for a thousand rows in one request gets nothing.
   */
  getEveryBroadcast(): Observable<BroadcastResponse[]> {
    const size = 100;
    return this.getAll({ page: 0, size, sort: 'createdAt', direction: 'desc' }).pipe(
      expand((res, index) => {
        const content = res?.data?.content ?? [];
        if (content.length < size || index > 100) return EMPTY;
        return this.getAll({ page: index + 1, size, sort: 'createdAt', direction: 'desc' });
      }),
      toArray(),
      map((pages) => pages.flatMap((p) => p?.data?.content ?? [])),
    );
  }

  /**
   * Delete a broadcast.
   *
   * The backend has `DELETE /api/dashboard/broadcasts/{id}` (it removes
   * the broadcast and its recipient rows), so the list can offer it. The
   * previous version threw instead, which left the page with no way to
   * get rid of a broadcast it did not want.
   */
  deleteBroadcast(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.fullUrl}/${id}`);
  }
}
