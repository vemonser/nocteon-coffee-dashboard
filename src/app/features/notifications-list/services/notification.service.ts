
import { inject, Injectable, signal } from '@angular/core';
import { NotificationResponse } from '../../notification/models/notification.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { Observable, tap } from 'rxjs';


@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private basePath = '/api/dashboard/notifications';

  private get fullUrl(): string {
    return `${environment.apiUrl}${this.basePath}`;
  }

  /** Used across the app (e.g. the bell icon in the header) */
  readonly unreadCount = signal(0);

  getAll(params: {
    unreadOnly?: boolean;
    page?: number;
    size?: number;
  }): Observable<ApiResponse<PageResponse<NotificationResponse>>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return this.http.get<ApiResponse<PageResponse<NotificationResponse>>>(this.fullUrl, {
      params: httpParams,
    });
  }

  refreshUnreadCount(): void {
    this.http
      .get<ApiResponse<number>>(`${this.fullUrl}/unread-count`)
      .subscribe({ next: (res) => this.unreadCount.set(res.data) });
  }

  markAsRead(id: number): Observable<ApiResponse<void>> {
    return this.http
      .patch<ApiResponse<void>>(`${this.fullUrl}/${id}/read`, null)
      .pipe(tap(() => this.refreshUnreadCount()));
  }

  markAllAsRead(): Observable<ApiResponse<void>> {
    return this.http
      .patch<ApiResponse<void>>(`${this.fullUrl}/read-all`, null)
      .pipe(tap(() => this.unreadCount.set(0)));
  }
}