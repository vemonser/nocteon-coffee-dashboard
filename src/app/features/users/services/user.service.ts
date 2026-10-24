import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseCrudService } from '../../../core/crud/base-crud.service';
import { UserListParams, UserRequest, UserResponse } from '../model/user.model';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';


@Injectable({ providedIn: 'root' })
export class UserService extends BaseCrudService<UserResponse, UserRequest> {
  protected override basePath = '/api/dashboard/users';

  getAll(params: UserListParams = {}): Observable<ApiResponse<PageResponse<UserResponse>>> {
    let p: HttpParams = this.buildBaseParams(params);
    if (params.role) p = p.set('role', params.role);
    if (params.isActive !== undefined) p = p.set('isActive', params.isActive);
    if (params.enabled !== undefined) p = p.set('enabled', params.enabled);

    return this.http.get<ApiResponse<PageResponse<UserResponse>>>(
      `${environment.apiUrl}${this.basePath}`,
      { params: p }
    );
  }

  getRoles(): Observable<ApiResponse<string[]>> {
    return this.http.get<ApiResponse<string[]>>(`${environment.apiUrl}${this.basePath}/roles`);
  }

  override delete(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiUrl}${this.basePath}/${id}`);
  }

  toggleActive(id: string): Observable<ApiResponse<UserResponse>> {
    return this.http.patch<ApiResponse<UserResponse>>(
      `${environment.apiUrl}${this.basePath}/${id}/toggle-active`,
      {}
    );
  }
  getById(id: string): Observable<ApiResponse<UserResponse>> {
     return this.http.get<ApiResponse<UserResponse>>(`${this.fullUrl}/${id}`);
   }
}