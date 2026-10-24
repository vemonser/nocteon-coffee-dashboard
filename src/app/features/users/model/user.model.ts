import { BaseListParams } from '../../../core/crud/base-crud.service';

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  role: string;
  enabled: boolean;
  active: boolean;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone?: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  permissions?: string[];
}

export interface UserRequest {
  firstName?: string;
  lastName?: string;
  role?: string;
  username?: string;
  phone?: string;
  email?: string;
  password?: string;
}

export interface UserListParams extends BaseListParams {
  role?: string;
  isActive?: boolean;
  enabled?: boolean;
}

/** A role as the roles endpoint describes it. */
export interface RoleResponse {
  name: string;
  description: string | null;
  system: boolean;
  userCount: number;
  permissionCount: number;
  permissions: string[];
}

export interface RoleRequest {
  name?: string;
  description?: string | null;
  permissions?: string[];
  cloneFrom?: string | null;
}
