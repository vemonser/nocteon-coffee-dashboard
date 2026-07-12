import { BaseListParams } from "../../../core/crud/base-crud.service";


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
  createdAt: string;
  lastActiveAt: string | null;
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
