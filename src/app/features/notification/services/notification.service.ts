// notification.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { interval, switchMap, startWith, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { NotificationDto } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private baseUrl = `${environment.apiUrl}/api/dashboard/notifications`;

  unreadCount = signal(0);

  constructor(private http: HttpClient) {
    // polling كل 15 ثانية، من أول ما الـ service يتعمله instantiate
    interval(150000)
      .pipe(
        startWith(0),
        switchMap(() => this.http.get<ApiResponse<number>>(`${this.baseUrl}/unread-count`)),
      )
      .subscribe((res) => this.unreadCount.set(res.data));
  }

  getNotifications(
    unreadOnly: boolean,
    page = 0,
    size = 10,
  ): Observable<ApiResponse<PageResponse<NotificationDto>>> {
    let httpParams = new HttpParams()
      .set('unreadOnly', String(unreadOnly))
      .set('page', String(page))
      .set('size', String(size));

    return this.http.get<ApiResponse<PageResponse<NotificationDto>>>(this.baseUrl, {
      params: httpParams,
    });
  }
  markAsRead(id: number) {
    return this.http.patch(`${this.baseUrl}/${id}/read`, {});
  }

  markAllAsRead() {
    return this.http.patch(`${this.baseUrl}/read-all`, {});
  }
}
