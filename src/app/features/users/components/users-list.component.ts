import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, Validators } from '@angular/forms';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucidePlus, lucideSearch, lucidePencil, lucideLock, lucideUnlock, lucideX, lucideCheck,
  lucideChevronLeft, lucideChevronRight, lucideUser, lucideShield, lucideMail, lucideLoader2,
  lucideMoreVertical, lucideTrash2, lucideEye, lucideBadgeCheck,
} from '@ng-icons/lucide';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';

import { BaseListComponent } from '../../../core/crud/base-list.component';
import { DataTableComponent, type TableSortEvent } from '../../../shared/components/data-table/data-table.component';
import { ActionsCellComponent, type RowMenuAction } from '../../../shared/ui/actions-cell/actions-cell.component';
import { HasPermissionDirective } from '../../../core/auth/permission.directive';
import { AuthService } from '../../../core/auth/auth.service';
import { UserService } from '../services/user.service';
import { UserListParams, UserRequest, UserResponse } from '../model/user.model';
import { ApiResponse, ListSummary, PageResponse } from '../../../core/models/api-response.model';
import { createColumnHelper, ColumnDef } from '@tanstack/angular-table';
import { HlmFieldImports } from '@spartan-ng/helm/field';

import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { NotifyService } from '../../../core/notify/notify.service';
import { humanize } from '../../../shared/utils/permission.utils';
import { RoleResponse } from '../model/user.model';
import { roleBadgeClasses } from '../utils/role-chips';

type QuickFilter = 'ALL' | 'BLOCKED' | 'UNVERIFIED' | (string & {});

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    PagerComponent, CommonModule, FormsModule, ReactiveFormsModule, HasPermissionDirective,
    DataTableComponent, HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmInputImports,
    HlmNativeSelectImports, HlmDialogImports, HlmFieldImports, HlmTableImports, HlmAvatarImports,
    HlmSkeletonImports, HlmLabelImports, HlmTooltipImports, NgIcon, TranslocoPipe,
  ],
  providers: [provideIcons({
    lucideLoader2, lucidePlus, lucideSearch, lucidePencil, lucideLock, lucideUnlock, lucideX,
    lucideCheck, lucideChevronLeft, lucideChevronRight, lucideUser, lucideShield, lucideMail,
    lucideMoreVertical, lucideTrash2, lucideEye, lucideBadgeCheck,
  })],
  templateUrl: './users-list.component.html',
  styles: [':host ::ng-deep app-data-table tbody tr { height: 72px !important; }'],
})
export class UsersListComponent extends BaseListComponent<UserResponse, UserRequest, string> {
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private i18n = inject(TranslocoService);

  roleOptions = signal<string[]>([]);
  /** The roles endpoint, in its own order — the source of the count chips. */
  roleCounts = signal<RoleResponse[]>([]);
  rolesAvailable = signal(false);
  roleFilter = 'ALL';
  statusFilter = 'all';
  verificationFilter = 'all';
  quickFilter = signal<QuickFilter>('ALL');

  /** Server aggregate from the users list response (not a page of rows). */
  summary = signal<ListSummary | null>(null);
  blockedTotal = signal(0);
  unverifiedTotal = signal(0);

  blocking = signal<UserResponse | null>(null);
  override deleting = signal<UserResponse | null>(null);
  deleteConfirmText = signal('');

  showPassword = signal(false);

  override ngOnInit(): void {
    // A role link from the Roles page (`/users?role=ADMIN`) seeds the filter
    // BEFORE the first page request, so the list never flashes all users.
    const roleFromUrl = this.route.snapshot.queryParamMap.get('role');
    if (roleFromUrl) {
      this.roleFilter = roleFromUrl;
      this.quickFilter.set(roleFromUrl);
    }
    super.ngOnInit();
    this.loadRoleOptions();
  }

  private loadRoleOptions(): void {
    this.userService.getRoles().subscribe({
      next: (res) => {
        const roles = res?.data ?? [];
        this.roleCounts.set(roles);
        this.rolesAvailable.set(roles.length > 0);
        this.roleOptions.set(roles.length ? roles.map((r) => r.name) : this.rolesFromItems());
        this.refreshStatusCounts();
      },
      error: () => {
        this.roleCounts.set([]);
        this.rolesAvailable.set(false);
        this.roleOptions.set(this.rolesFromItems());
        this.refreshStatusCounts();
      },
    });
  }

  private rolesFromItems(): string[] {
    return Array.from(new Set(this.items().map((u) => u.role)));
  }

  /** Blocked and unverified are status buckets, not roles — two size-1 calls. */
  private refreshStatusCounts(): void {
    forkJoin({
      blocked: this.userService
        .getAll({ page: 0, size: 1, isActive: false })
        .pipe(map((res) => res.data.totalElements), catchError(() => of(null))),
      unverified: this.userService
        .getAll({ page: 0, size: 1, enabled: false })
        .pipe(map((res) => res.data.totalElements), catchError(() => of(null))),
    }).subscribe(({ blocked, unverified }) => {
      this.blockedTotal.set(blocked ?? 0);
      this.unverifiedTotal.set(unverified ?? 0);
    });
  }

  roleLabel(name: string): string {
    const key = `users.roleNames.${name}`;
    const translated = this.i18n.translate(key);
    if (typeof translated === 'string' && translated && translated !== key) return translated;
    return humanize(name);
  }

  /**
   * The role cell's tint and tooltip. Admin copper, Moderator blue, Customer
   * neutral; anything else gets a stable colour from the five-token palette.
   */
  roleBadgeFor = (role: string): { classes: string; label: string; title: string } => {
    const label = this.roleLabel(role);
    const permissionCount = this.roleCounts().find((r) => r.name === role)?.permissionCount ?? 0;
    const title = this.i18n.translate('users.roleBadgeTooltip', {
      role: label,
      count: permissionCount,
    });
    return { classes: roleBadgeClasses(role), label, title };
  };

  // Columns
  private columnHelper = createColumnHelper<UserResponse>();
  columns: ColumnDef<UserResponse, any>[] = [
    this.columnHelper.accessor((row) => ({
      avatar: row.avatarUrl, name: this.getFullName(row) || row.username, email: row.email, verified: row.enabled,
    }), { id: 'userFullName', header: 'User', enableSorting: true, meta: { width: '32%' } }),
    this.columnHelper.accessor('role', { id: 'role', header: 'Role', enableSorting: true, meta: { width: '14%' } }),
    this.columnHelper.accessor((row) => this.getStatus(row), { id: 'status', header: 'Status', enableSorting: false, meta: { width: '12%' } }),
    this.columnHelper.accessor((row) => row.createdAt, { id: 'joined', header: 'Joined', enableSorting: true, meta: { width: '14%' } }),
    this.columnHelper.accessor((row) => row.lastActiveAt, { id: 'lastActive', header: 'Last active', enableSorting: true, meta: { width: '16%' } }),
    this.columnHelper.display({ id: 'actions', header: 'Actions', enableSorting: false, meta: { width: '6%' } }),
  ];

  readonly totalUsers = computed(
    () => this.summary()?.total ?? this.pageData()?.totalElements ?? this.items().length,
  );
  readonly blockedCount = computed(() => this.blockedTotal());
  readonly unverifiedCount = computed(() => this.unverifiedTotal());

  protected override readonly Math = Math;

  protected override getId(user: UserResponse): string { return user.id; }

  protected override loadPage(): Observable<PageResponse<UserResponse>> {
    const params: UserListParams = {
      page: this.currentPage(), size: this.pageSize(), search: this.searchQuery || undefined,
      sort: this.currentSort, direction: this.currentDirection,
      role: this.roleFilter === 'ALL' ? undefined : this.roleFilter,
      isActive: this.statusFilter === 'all' ? undefined : this.statusFilter === 'active',
      enabled: this.verificationFilter === 'all' ? undefined : this.verificationFilter === 'verified',
    };
    return this.userService.getAll(params).pipe(
      tap((res) => this.summary.set(res.summary ?? null)),
      map((res) => res.data),
    );
  }

  protected override buildForm(): FormGroup {
    return this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      role: ['CUSTOMER', Validators.required],
      phone: [''], firstName: [''], lastName: [''],
    });
  }

  override openCreateDialog(): void {
    super.openCreateDialog();
    this.form.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.get('password')?.updateValueAndValidity();
    this.form.get('confirmPassword')?.setValidators([Validators.required]);
    this.form.get('confirmPassword')?.updateValueAndValidity();
    this.showPassword.set(false);
    this.updatePhoneValidators();
    this.form.get('role')?.valueChanges.subscribe(() => this.updatePhoneValidators());
  }

  protected override onEditOpen(user: UserResponse): void {
    this.form.patchValue({
      username: user.username, email: user.email, role: user.role,
      firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '',
    });
    this.form.get('password')?.clearValidators();
    this.form.get('password')?.updateValueAndValidity();
    this.form.get('confirmPassword')?.clearValidators();
    this.form.get('confirmPassword')?.updateValueAndValidity();
    this.updatePhoneValidators();
  }

  updatePhoneValidators(): void {
    const role = this.form.get('role')?.value;
    const phone = this.form.get('phone');
    if (!phone) return;
    if (role === 'CUSTOMER') phone.setValidators([Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]);
    else phone.clearValidators();
    phone.updateValueAndValidity({ emitEvent: false });
  }

  protected override toRequest(): UserRequest {
    const val = this.form.getRawValue();
    const req: UserRequest = {
      username: val.username, email: val.email, phone: val.phone, role: val.role,
      firstName: val.firstName || undefined, lastName: val.lastName || undefined,
    };
    if (!this.editing() && val.password) req.password = val.password;
    return req;
  }

  protected override callCreate(req: UserRequest): Observable<ApiResponse<UserResponse>> { return this.userService.create(req); }
  protected override callUpdate(id: string, req: UserRequest): Observable<ApiResponse<UserResponse>> { return this.userService.update(id, req); }
  protected override callDelete(id: string): Observable<any> { return throwError(() => new Error('Use delete dialog')); }
  override submitDelete(): void {}

  override goToDetail(user: UserResponse): void { this.router.navigate(['/dashboard/users', user.id]); }

  getFullName(user: UserResponse): string {
    const first = user.firstName || ''; const last = user.lastName || '';
    return (first + ' ' + last).trim() || user.username;
  }

  getStatus(user: UserResponse): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' } {
    if (!user.enabled) return { label: 'Unverified', variant: 'warning' };
    if (!user.active) return { label: 'Blocked', variant: 'destructive' };
    return { label: 'Active', variant: 'default' };
  }

  getInitials(user: UserResponse): string {
    const first = user.firstName?.[0] || ''; const last = user.lastName?.[0] || ''; const username = user.username?.[0] || '';
    return (first + last || username).toUpperCase();
  }

  isSelf(user: UserResponse): boolean { return String(this.auth.currentUser()?.id) === String(user.id); }
  isLastAdmin(user: UserResponse): boolean {
    const adminCount = this.roleCounts().find((r) => r.name === 'ADMIN')?.userCount ?? 0;
    return user.role === 'ADMIN' && adminCount <= 1;
  }
  safeguardsDisabled(user: UserResponse): boolean { return this.isSelf(user) || this.isLastAdmin(user); }
  safeguardTooltip(user: UserResponse): string {
    if (this.isSelf(user)) return "You can't do this on your own account";
    if (this.isLastAdmin(user)) return 'At least one admin is required';
    return '';
  }

  menuActionsFor = (row: UserResponse): RowMenuAction[] => {
    const disabled = this.safeguardsDisabled(row);
    const tooltip = this.safeguardTooltip(row);
    const items: RowMenuAction[] = [
      { id: 'view', label: 'common.view', icon: 'lucideEye' },
      { id: 'edit', label: 'common.edit', icon: 'lucidePencil' },
      { id: 'changeRole', label: this.rolesAvailable() ? 'users.changeRole' : 'users.changeRoleSoon', icon: 'lucideShield', disabled: !this.rolesAvailable() || disabled, tooltip: (!this.rolesAvailable() || disabled) ? (disabled ? tooltip : undefined) : undefined },
    ];
    items.push({ id: row.active ? 'block' : 'unblock', label: row.active ? 'users.block' : 'users.unblock', icon: row.active ? 'lucideLock' : 'lucideUnlock', disabled, tooltip: disabled ? tooltip : undefined });
    items.push({ id: 'separator', label: '', disabled: true });
    items.push({ id: 'delete', label: 'common.delete', icon: 'lucideTrash2', danger: true, disabled, tooltip: disabled ? tooltip : undefined });
    return items;
  };

  onMenuAction(event: { id: string; item: UserResponse }): void {
    switch (event.id) {
      case 'view': this.goToDetail(event.item); break;
      case 'edit': this.openEditDialog(event.item); break;
      case 'block':
      case 'unblock': this.blocking.set(event.item); break;
      case 'delete': this.deleting.set(event.item); this.deleteConfirmText.set(''); break;
    }
  }

  confirmBlock(): void {
    const user = this.blocking();
    if (!user) return;
    this.submitting.set(true);
    this.userService.toggleActive(user.id).subscribe({
      next: () => { this.submitting.set(false); this.blocking.set(null); this.load(); this.refreshStatusCounts(); this.notify.success('notify.statusUpdated', 'Status updated'); },
      error: (err) => { this.submitting.set(false); this.notify.apiError(err, 'notify.errorFallback', 'Could not update status'); },
    });
  }

  confirmDeleteUser(): void {
    const user = this.deleting();
    if (!user || this.deleteConfirmText() !== user.username) return;
    this.submitting.set(true);
    this.userService.delete(user.id).subscribe({
      next: () => { this.submitting.set(false); this.deleting.set(null); this.deleteConfirmText.set(''); this.load(); this.notify.success('users.deleted', 'User deleted'); },
      error: (err) => { this.submitting.set(false); this.notify.apiError(err, 'notify.errorFallback', 'Could not delete user'); },
    });
  }

  onFilterChange(): void {
    this.quickFilter.set('ALL');
    this.currentPage.set(0);
    this.load();
  }

  /**
   * One chip strip: All, one chip per role (from the roles endpoint), then the
   * two status buckets. A role chip filters the Role select to that role, so
   * the strip and the select never disagree.
   */
  setQuickFilter(filter: QuickFilter): void {
    this.quickFilter.set(filter);
    this.roleFilter = 'ALL';
    this.statusFilter = 'all';
    this.verificationFilter = 'all';
    if (filter === 'BLOCKED') {
      this.statusFilter = 'blocked';
      this.verificationFilter = 'verified';
    } else if (filter === 'UNVERIFIED') {
      this.verificationFilter = 'unverified';
    } else if (filter !== 'ALL') {
      this.roleFilter = filter;
    }
    this.currentPage.set(0);
    this.load();
  }
}
