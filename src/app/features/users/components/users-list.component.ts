import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
// Icons
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus,
  lucideSearch,
  lucidePencil,
  lucideLock,
  lucideUnlock,
  lucideX,
  lucideCheck,
  lucideChevronLeft,
  lucideChevronRight,
  lucideUser,
  lucideShield,
  lucideMail,
  lucideLoader2,
} from '@ng-icons/lucide';

// Spartan UI
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmLabelImports } from '@spartan-ng/helm/label';

// App imports
import { BaseListComponent } from '../../../core/crud/base-list.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { UserService } from '../services/user.service';
import { UserListParams, UserRequest, UserResponse } from '../model/user.model';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { createColumnHelper, ColumnDef } from '@tanstack/angular-table';
import { HlmField, HlmFieldImports, HlmFieldLabel } from '@spartan-ng/helm/field';

import { TranslocoPipe } from '@jsverse/transloco';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { NotifyService } from '../../../core/notify/notify.service';
type RoleFilter = 'ALL' | 'ADMIN' | 'CUSTOMER';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    PagerComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HasPermissionDirective,
    DataTableComponent,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmSelectImports,
    HlmDialogImports,
    HlmFieldImports,
    HlmTableImports,
    HlmAvatarImports,
    HlmSkeletonImports,
    HlmLabelImports,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({ lucideLoader2, lucidePlus,
      lucideSearch,
      lucidePencil,
      lucideLock,
      lucideUnlock,
      lucideX,
      lucideCheck,
      lucideChevronLeft,
      lucideChevronRight,
      lucideUser,
      lucideShield,
      lucideMail,
    }),
  ],
  templateUrl: './users-list.component.html',
})
export class UsersListComponent extends BaseListComponent<UserResponse, UserRequest, string> {
  private userService = inject(UserService);
  private router = inject(Router); // ← جديد
  permission = [
    { label: 'Customer', value: 'CUSTOMER' },
    { label: 'Admin', value: 'ADMIN' },
  ];

  itemToString = (value: string) =>
    this.permission.find((item) => item.value === value)?.label || '';

  // Filters
  roleFilter: RoleFilter = 'ALL';
  isActiveFilter: boolean | undefined = undefined;
  enabledFilter: boolean | undefined = undefined;
  
  override goToDetail(user: UserResponse): void {
    this.router.navigate(['/dashboard/users', user.id]);
  }
  // Columns
  private columnHelper = createColumnHelper<UserResponse>();
  columns: ColumnDef<UserResponse, any>[] = [
    this.columnHelper.accessor((row) => row.avatarUrl, {
      id: 'avatar',
      header: 'Avatar',
      enableSorting: false,
    }),
    this.columnHelper.accessor('username', {
      header: 'Username',
      enableSorting: true,
    }),
    this.columnHelper.accessor('email', {
      header: 'Email',
      enableSorting: true,
    }),
    this.columnHelper.accessor((row) => this.getFullName(row), {
      id: 'fullName',
      header: 'Full Name',
      enableSorting: false,
    }),
    this.columnHelper.accessor('role', {
      header: 'Role',
      enableSorting: true,
    }),
    this.columnHelper.accessor(
      (row) => {
        return this.getStatus(row);
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
      },
    ),
    this.columnHelper.accessor((row) => row.createdAt, {
      id: 'joined',
      header: 'Joined',
      enableSorting: true,
    }),
    this.columnHelper.display({
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
    }),
  ];

  readonly totalUsers = computed(() => this.items().length);
  readonly activeUsers = computed(() => this.items().filter((u) => u.enabled && u.active).length);
  readonly blockedUsers = computed(() => this.items().filter((u) => u.enabled && !u.active).length);
  readonly unverifiedUsers = computed(() => this.items().filter((u) => !u.enabled).length);

  protected override readonly Math = Math;

  // ─── Base contract ─────────────────────────────────────────────────────────

  protected override getId(user: UserResponse): string {
    return user.id;
  }

  protected override loadPage(): Observable<PageResponse<UserResponse>> {
    const params: UserListParams = {
      page: this.currentPage(),
        size: this.pageSize(),
      search: this.searchQuery || undefined,
      sort: this.currentSort,
      direction: this.currentDirection,
      role: this.roleFilter === 'ALL' ? undefined : this.roleFilter,
      isActive: this.isActiveFilter,
      enabled: this.enabledFilter,
    };
    return this.userService.getAll(params).pipe(map((res) => res.data));
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      role: ['CUSTOMER', Validators.required],
      phone: [''],
      firstName: [''],
      lastName: [''],
      isActive: [true],
    });
  }

  override openCreateDialog(): void {
    super.openCreateDialog();
    this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.get('password')?.updateValueAndValidity();
    this.form.get('confirmPassword')?.setValidators([Validators.required]);
    this.form.get('confirmPassword')?.updateValueAndValidity();
  }

  protected override onEditOpen(user: UserResponse): void {
    this.form.patchValue({
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      isActive: user.active,
    });
    this.form.get('password')?.clearValidators();
    this.form.get('password')?.updateValueAndValidity();
    this.form.get('confirmPassword')?.clearValidators();
    this.form.get('confirmPassword')?.updateValueAndValidity();
  }

  protected override toRequest(): UserRequest {
    const val = this.form.value;
    const req: UserRequest = {
      username: val.username,
      email: val.email,
      phone: val.phone,
      role: val.role,
      firstName: val.firstName || undefined,
      lastName: val.lastName || undefined,
    };
    if (!this.editing() && val.password) {
      req.password = val.password;
    }
    return req;
  }

  protected override callCreate(req: UserRequest): Observable<ApiResponse<UserResponse>> {
    return this.userService.create(req);
  }

  protected override callUpdate(
    id: string,
    req: UserRequest,
  ): Observable<ApiResponse<UserResponse>> {
    return this.userService.update(id, req);
  }

  protected override callDelete(id: string): Observable<any> {
    return throwError(() => new Error('Delete not supported for users'));
  }

  // Override delete to be block/unblock toggle
  override submitDelete(): void {
    const user = this.deleting();
    if (!user) return;
    this.submitting.set(true);
    const willBlock = user.active;
    this.userService.toggleActive(user.id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.deleting.set(null);
        this.load();
        this.notify.success('notify.statusUpdated', 'Status updated');
      },
      error: (err) => {
        this.submitting.set(false);
        this.notify.apiError(
          err,
          'notify.errorFallback',
          willBlock ? 'Could not block user' : 'Could not unblock user',
        );
      },
    });
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  getFullName(user: UserResponse): string {
    const first = user.firstName || '';
    const last = user.lastName || '';
    return (first + ' ' + last).trim() || '—';
  }

  getStatus(user: UserResponse): {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning';
  } {
    if (!user.enabled) return { label: 'Unverified', variant: 'warning' };
    if (!user.active) return { label: 'Blocked', variant: 'destructive' };
    return { label: 'Active', variant: 'default' };
  }

  getRoleVariant(role: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    return role === 'ADMIN' ? 'destructive' : 'secondary';
  }

  getInitials(user: UserResponse): string {
    const first = user.firstName?.[0] || '';
    const last = user.lastName?.[0] || '';
    const username = user.username?.[0] || '';
    return (first + last || username).toUpperCase();
  }

  onFilterChange(): void {
    this.currentPage.set(0);
    this.load();
  }
}