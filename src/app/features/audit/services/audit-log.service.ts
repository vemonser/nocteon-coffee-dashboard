import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { AuditLogEntry, AuditLogQuery } from '../models/audit-log.model';

/**
 * The audit trail endpoint.
 *
 * <p>Read-only, one method: the log is the record of what happened, so the page
 * never writes to it. `GET /api/dashboard/audit-logs` needs `audit:read`.
 */
@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly basePath = '/api/dashboard/audit-logs';

  getPage(query: AuditLogQuery = {}): Observable<ApiResponse<PageResponse<AuditLogEntry>>> {
    return this.http.get<ApiResponse<PageResponse<AuditLogEntry>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: this.toParams(query) },
    );
  }

  private toParams(query: AuditLogQuery): HttpParams {
    let params = new HttpParams()
      .set('page', query.page ?? 0)
      .set('size', query.size ?? 20)
      .set('sort', query.sort ?? 'createdAt')
      .set('direction', query.direction ?? 'desc');

    // An unset filter is LEFT OUT, not sent as an empty string: `actor=` would
    // ask the server for "an empty id or an email containing nothing".
    const text = (value: string | undefined) => value?.trim();
    const action = text(query.action);
    if (action) params = params.set('action', action);
    const actor = text(query.actor);
    if (actor) params = params.set('actor', actor);
    if (query.since) params = params.set('since', query.since);
    if (query.until) params = params.set('until', query.until);
    return params;
  }
}
