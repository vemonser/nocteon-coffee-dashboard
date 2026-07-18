import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { JournalFilterParams, JournalPostRequest, JournalPostResponse } from '../models/journal.model';

@Injectable({ providedIn: 'root' })
export class JournalService {
  private http = inject(HttpClient);
  private basePath = '/api/dashboard/journal';

  private get fullUrl(): string {
    return `${environment.apiUrl}${this.basePath}`;
  }

  getAll(params: JournalFilterParams): Observable<ApiResponse<PageResponse<JournalPostResponse>>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<ApiResponse<PageResponse<JournalPostResponse>>>(this.fullUrl, {
      params: httpParams,
    });
  }

  getBySlug(slug: string): Observable<ApiResponse<JournalPostResponse>> {
    return this.http.get<ApiResponse<JournalPostResponse>>(`${this.fullUrl}/${slug}`);
  }

  create(request: JournalPostRequest, image: File | null): Observable<ApiResponse<JournalPostResponse>> {
    return this.http.post<ApiResponse<JournalPostResponse>>(this.fullUrl, this.buildFormData(request, image));
  }

  update(
    slug: string,
    request: JournalPostRequest,
    image: File | null,
  ): Observable<ApiResponse<JournalPostResponse>> {
    return this.http.put<ApiResponse<JournalPostResponse>>(
      `${this.fullUrl}/${slug}`,
      this.buildFormData(request, image),
    );
  }

  remove(slug: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.fullUrl}/${slug}`);
  }

  private buildFormData(request: JournalPostRequest, image: File | null): FormData {
    const formData = new FormData();
    formData.append('data', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    if (image) {
      formData.append('image', image);
    }
    return formData;
  }
}