import { inject, Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';
import {  ReviewRequest, ReviewResponse } from '../models/review.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BaseCrudService } from '../../../core/crud/base-crud.service';

@Injectable({ providedIn: 'root' })
export class ReviewService extends BaseCrudService<ReviewResponse, ReviewRequest> {
  protected override basePath = '/api/dashboard/reviews';

  getAll(params: {
    page?: number;
    sort?: string;
    direction?: string;
    productSlug?: string;
    isApproved?: boolean;
  }): Observable<ApiResponse<PageResponse<ReviewResponse>>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<ApiResponse<PageResponse<ReviewResponse>>>(this.fullUrl, {
      params: httpParams,
    });
  }

  setApproval(id: number, approved: boolean): Observable<ApiResponse<ReviewResponse>> {
    return this.http.patch<ApiResponse<ReviewResponse>>(
      `${this.fullUrl}/${id}/approval`,
      null,
      { params: { approved: String(approved) } },
    );
  }

  remove(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.fullUrl}/${id}`);
  }
}