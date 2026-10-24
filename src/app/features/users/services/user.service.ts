import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseCrudService } from '../../../core/crud/base-crud.service';
import {
  RoleRequest,
  RoleResponse,
  UserListParams,
  UserRequest,
  UserResponse,
} from '../model/user.model';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { environment } from '../../../../environments/environment';

/**
 * Users and roles share one controller family in the API but two prefixes:
 * users live under `/api/dashboard/users`, roles under `/api/dashboard/roles`.
 * Role changes have their own endpoint (`PUT /users/{id}/role`) because the
 * general update cannot express — or audit — a permission diff.
 */
@Injectable({ providedIn: 'root' })
export class UserService extends BaseCrudService<UserResponse, UserRequest> {
  protected override basePath = '/api/dashboard/users';

  private get rolesUrl(): string {
    return `${environment.apiUrl}/api/dashboard/roles`;
  }

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

  /** `GET /api/dashboard/roles` — name, description, system flag, user and permission counts. */
  getRoles(): Observable<ApiResponse<RoleResponse[]>> {
    return this.http.get<ApiResponse<RoleResponse[]>>(this.rolesUrl);
  }

  getRoleByName(name: string): Observable<ApiResponse<RoleResponse>> {
    return this.http.get<ApiResponse<RoleResponse>>(`${this.rolesUrl}/${encodeURIComponent(name)}`);
  }

  createRole(body: RoleRequest): Observable<ApiResponse<RoleResponse>> {
    return this.http.post<ApiResponse<RoleResponse>>(this.rolesUrl, body);
  }

  updateRole(name: string, body: RoleRequest): Observable<ApiResponse<RoleResponse>> {
    return this.http.put<ApiResponse<RoleResponse>>(
      `${this.rolesUrl}/${encodeURIComponent(name)}`,
      body
    );
  }

  deleteRole(name: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.rolesUrl}/${encodeURIComponent(name)}`);
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
