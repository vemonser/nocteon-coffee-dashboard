import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { ContactListParams, ContactResponse, ContactStats } from '../models/contact-message.model';

@Injectable({ providedIn: 'root' })
export class ContactMessageService {
  private http = inject(HttpClient);
  private basePath = '/api/dashboard/contact-messages';

  getAll(params: ContactListParams = {}): Observable<ApiResponse<PageResponse<ContactResponse>>> {
    let httpParams = this.toParams(params);
    if (params.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<ApiResponse<PageResponse<ContactResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: httpParams },
    );
  }

  getByStatus(status: 'NEW' | 'REPLIED' | 'ARCHIVED', params: ContactListParams = {}): Observable<ApiResponse<PageResponse<ContactResponse>>> {
    let httpParams = this.toParams(params);
    return this.http.get<ApiResponse<PageResponse<ContactResponse>>>(
      `${environment.apiUrl}${this.basePath}/status/${status}`,
      { params: httpParams },
    );
  }

  getStats(): Observable<ApiResponse<ContactStats>> {
    return this.http.get<ApiResponse<ContactStats>>(`${environment.apiUrl}${this.basePath}/stats/summary`);
  }

  /** The unread list comes from its own endpoint, so the count and the rows
   *  are the server's, not an estimate over what happened to be loaded. */
  getAllUnread(
    params: ContactListParams = {},
  ): Observable<ApiResponse<PageResponse<ContactResponse>>> {
    return this.http.get<ApiResponse<PageResponse<ContactResponse>>>(
      `${environment.apiUrl}${this.basePath}/unread`,
      { params: this.toParams(params) },
    );
  }

  private toParams(params: ContactListParams): HttpParams {
    let httpParams = new HttpParams()
      .set('page', params.page ?? 0)
      .set('size', params.size ?? 100)
      .set('sort', params.sort ?? 'createdAt')
      .set('direction', params.direction ?? 'desc');
    if (params.search?.trim()) httpParams = httpParams.set('search', params.search.trim());
    return httpParams;
  }

  getById(id: number): Observable<ApiResponse<ContactResponse>> {
    return this.http.get<ApiResponse<ContactResponse>>(`${environment.apiUrl}${this.basePath}/${id}`);
  }

  markAsRead(id: number): Observable<ApiResponse<ContactResponse>> {
    return this.http.patch<ApiResponse<ContactResponse>>(
      `${environment.apiUrl}${this.basePath}/${id}/read`,
      null,
    );
  }

  reply(id: number, replyContent: string): Observable<ApiResponse<ContactResponse>> {
    return this.http.post<ApiResponse<ContactResponse>>(
      `${environment.apiUrl}${this.basePath}/${id}/reply`,
      { replyContent },
    );
  }

  /** Send the stored reply again, without changing it. */
  resendEmail(id: number): Observable<ApiResponse<ContactResponse>> {
    return this.http.post<ApiResponse<ContactResponse>>(
      `${environment.apiUrl}${this.basePath}/${id}/resend-email`,
      null,
    );
  }

  archive(id: number): Observable<ApiResponse<ContactResponse>> {
    return this.http.patch<ApiResponse<ContactResponse>>(
      `${environment.apiUrl}${this.basePath}/${id}/archive`,
      null,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${this.basePath}/${id}`);
  }
}
