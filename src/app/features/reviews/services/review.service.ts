import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import { ReviewListParams, ReviewResponse, ReviewStats, ReviewRejectRequest } from '../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private basePath = '/api/dashboard/reviews';

  getAll(params: ReviewListParams = {}): Observable<ApiResponse<PageResponse<ReviewResponse>>> {
    let httpParams = new HttpParams()
      .set('page', params.page ?? 0)
      .set('size', params.size ?? 20)
      .set('sort', params.sort ?? 'createdAt')
      .set('direction', params.direction ?? 'desc');
    if (params.productSlug) httpParams = httpParams.set('productSlug', params.productSlug);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.isApproved !== undefined) httpParams = httpParams.set('isApproved', params.isApproved);
    if (params.isVerified !== undefined) httpParams = httpParams.set('isVerified', params.isVerified);
    if (params.minRating !== undefined) httpParams = httpParams.set('minRating', params.minRating);
    if (params.createdFrom) httpParams = httpParams.set('createdFrom', params.createdFrom);
    if (params.createdTo) httpParams = httpParams.set('createdTo', params.createdTo);

    return this.http.get<ApiResponse<PageResponse<ReviewResponse>>>(`${environment.apiUrl}${this.basePath}`, {
      params: httpParams,
    });
  }

  getStats(): Observable<ApiResponse<ReviewStats>> {
    return this.http.get<ApiResponse<ReviewStats>>(`${environment.apiUrl}${this.basePath}/stats`);
  }

  setApproval(ids: number[], approved: boolean): Observable<ApiResponse<{ updated: number }>> {
    return this.http.patch<ApiResponse<{ updated: number }>>(`${environment.apiUrl}${this.basePath}/approval`, {
      ids,
      approved,
    });
  }

  setSingleApproval(id: number, approved: boolean): Observable<ApiResponse<ReviewResponse>> {
    return this.http.patch<ApiResponse<ReviewResponse>>(
      `${environment.apiUrl}${this.basePath}/${id}/approval`,
      null,
      { params: new HttpParams().set('approved', approved) },
    );
  }

  setRejected(id: number): Observable<ApiResponse<ReviewResponse>> {
    return this.http.patch<ApiResponse<ReviewResponse>>(
      `${environment.apiUrl}${this.basePath}/${id}/reject`,
      null,
    );
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}${this.basePath}/${id}`);
  }
}
