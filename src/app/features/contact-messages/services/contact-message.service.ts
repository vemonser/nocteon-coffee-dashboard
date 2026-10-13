import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { ContactResponse } from '../models/contact-message.model';

@Injectable({ providedIn: 'root' })
export class ContactMessageService {
  private http = inject(HttpClient);
  private basePath = '/api/dashboard/contact-messages';

  getAll(params: {
    page?: number;
    size?: number;
    search?: string;
    sort?: string;
    direction?: 'asc' | 'desc';
  }): Observable<ApiResponse<PageResponse<ContactResponse>>> {
    let httpParams = new HttpParams().set('page', params.page ?? 0).set('size', params.size ?? 20);
    if (params.search?.trim()) httpParams = httpParams.set('search', params.search.trim());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);
    if (params.direction) httpParams = httpParams.set('direction', params.direction);
    return this.http.get<ApiResponse<PageResponse<ContactResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: httpParams },
    );
  }
}