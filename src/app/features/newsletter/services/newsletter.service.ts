import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, toArray } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { UserResponse } from '../../users/model/user.model';

/**
 * The newsletter audience.
 *
 * A newsletter goes to the store's CUSTOMERS — the same set a broadcast
 * reaches (the backend picks the broadcast recipients with
 * `findByRoleAndSubscribedTrue(CUSTOMER)`), so this is the users endpoint
 * with the customer role.
 *
 * **What the API does NOT say:** the admin `UserResponse` carries no
 * newsletter flag, and the list has no `subscribed` filter, so this page
 * cannot tell a subscribed customer from an unsubscribed one. The page
 * says so in the help line under the header rather than pretending the
 * list is a subscription list.
 */
@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly http = inject(HttpClient);
  private readonly basePath = '/api/dashboard/users';

  /** The biggest page the API accepts (`size` is validated, max 100). */
  private static readonly MAX_PAGE_SIZE = 100;

  /** The audience, one page at a time. */
  getAll(params: {
    page?: number;
    size?: number;
    search?: string;
    sort?: string;
    direction?: string;
  }): Observable<PageResponse<UserResponse>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    // The audience of a newsletter is the store's customers.
    httpParams = httpParams.set('role', 'CUSTOMER');
    return this.http
      .get<ApiResponse<PageResponse<UserResponse>>>(`${environment.apiUrl}${this.basePath}`, {
        params: httpParams,
      })
      .pipe(map((res) => res.data));
  }

  /**
   * EVERY address of the audience, page after page.
   *
   * The export needs the whole audience, and the API caps a page at 100
   * rows, so a single "size: 1000" request is REJECTED (400) — the export
   * has to walk the pages.
   */
  getEveryAddress(): Observable<UserResponse[]> {
    const size = NewsletterService.MAX_PAGE_SIZE;
    return this.getAll({ page: 0, size, sort: 'email', direction: 'asc' }).pipe(
      // Walk the pages until one comes back short (the last one) — the API
      // caps a page at 100 rows, so a single big request is rejected.
      expand((page, index) => {
        const content = page?.content ?? [];
        if (content.length < size || index > 100) return EMPTY;
        return this.getAll({ page: index + 1, size, sort: 'email', direction: 'asc' });
      }),
      toArray(),
      map((pages) => pages.flatMap((p) => p?.content ?? [])),
    );
  }
}
