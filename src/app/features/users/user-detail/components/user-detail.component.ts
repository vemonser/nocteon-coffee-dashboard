import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft, lucideCheck, lucideLoader2, lucideLock, lucideMail, lucidePencil,
  lucideShield, lucideTrash2, lucideUnlock, lucideUser, lucideX, lucideBadgeCheck,
} from '@ng-icons/lucide';

import { UserService } from '../../services/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';
import { RoleResponse, UserRequest, UserResponse } from '../../model/user.model';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LocalizedDateComponent } from '../../../../shared/ui/localized-date/localized-date.component';
import { FormatRelativePipe } from '../../../../shared/pipes/relative-time.pipe';
import { FormatDateTimePipe } from '../../../../shared/pipes/date-time.pipe';
import { PermissionMatrixComponent } from '../../../../shared/components/permission-matrix/permission-matrix.component';
import {
  ALL_PERMISSIONS, actionLabel, humanize, parsePermission,
} from '../../../../shared/utils/permission.utils';
import { diffPermissions } from '../../utils/role-diff';
import { roleBadgeClasses } from '../../utils/role-chips';
import { NotifyService } from '../../../../core/notify/notify.service';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    LocalizedDateComponent, CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmInputImports, HlmLabelImports,
    HlmSkeletonImports, HlmSeparatorImports, HlmAvatarImports, HlmNativeSelectImports, HlmDropdownMenuImports, NgIcon, TranslocoPipe, PermissionMatrixComponent, FormatRelativePipe, FormatDateTimePipe,
  ],
  providers: [provideIcons({
    lucideArrowLeft, lucidePencil, lucideLock, lucideUnlock, lucideCheck, lucideX, lucideLoader2,
    lucideUser, lucideShield, lucideMail, lucideTrash2, lucideBadgeCheck,
  })],
  templateUrl: './user-detail.component.html',
})
export class UserDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private auth = inject(AuthService);
  private breadcrumbService = inject(BreadcrumbService);
  private notify = inject(NotifyService);
  private transloco = inject(TranslocoService);

  readonly user = signal<UserResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly blocking = signal<UserResponse | null>(null);
  readonly deleting = signal<UserResponse | null>(null);
  readonly deleteConfirmText = signal('');

  readonly showEditDialog = signal(false);
  readonly showRoleDialog = signal(false);
  readonly newRole = signal('');
  readonly roleConfirmText = signal('');
  /** Full role records: the dialog needs descriptions and permission sets. */
  readonly roleDetails = signal<RoleResponse[]>([]);
  /** How many admins exist — the last one must keep the role. */
  readonly adminCount = signal<number | null>(null);
  readonly allPermissions = ALL_PERMISSIONS;
  readonly roleBadgeClasses = roleBadgeClasses;

  readonly targetRole = computed(
    () => this.roleDetails().find((r) => r.name === this.newRole()) ?? null,
  );

  readonly roleDiff = computed(() => {
    const user = this.user();
    const target = this.targetRole();
    if (!user || !target) return { granted: [], revoked: [], sensitiveGranted: [] };
    return diffPermissions(user.permissions ?? [], target.permissions ?? []);
  });

  /** Only a GRANTED sensitive permission needs the typed-username confirmation. */
  readonly requiresUsername = computed(() => this.roleDiff().sensitiveGranted.length > 0);

  readonly isLastAdmin = computed(() => {
    const user = this.user();
    return !!user && user.role === 'ADMIN' && (this.adminCount() ?? 0) <= 1;
  });

  /** Own account and the last admin may not be re-roled. */
  readonly canChangeRole = computed(() => {
    const user = this.user();
    if (!user) return false;
    return !this.isSelf(user) && !this.isLastAdmin();
  });

  readonly roleChangeBlockedReason = computed(() => {
    const user = this.user();
    if (!user) return '';
    if (this.isSelf(user)) return this.transloco.translate('users.roleChange.ownAccount');
    if (this.isLastAdmin()) return this.transloco.translate('users.roleChange.lastAdmin');
    return '';
  });

  form!: FormGroup;

  ngOnInit(): void {
    this.userService.getRoles().subscribe({
      next: (r) => {
        const roles = r?.data ?? [];
        this.roleDetails.set(roles);
      },
    });

    // The admin count gates the last-admin guard; the users endpoint's summary
    // is unfiltered, so one size-1 page carries the number.
    this.userService.getAll({ page: 0, size: 1, role: 'ADMIN' }).subscribe({
      next: (res) => this.adminCount.set(res.summary?.admins ?? res.data.totalElements),
      error: () => this.adminCount.set(null),
    });

    this.route.paramMap.pipe(
      map((params) => params.get('id')),
      switchMap((id) => {
        if (!id) { this.error.set('User not found'); return of(null); }
        this.loading.set(true);
        return this.userService.getById(id).pipe(catchError((err) => {
          this.error.set(err?.error?.message || 'Failed to load user');
          return of(null);
        }));
      }),
    ).subscribe((res) => {
      this.loading.set(false);
      if (res?.data) {
        this.user.set(res.data);
        this.buildForm(res.data);
        this.breadcrumbService.updateLastLabel(this.getFullName(res.data));
      }
    });
  }

  private buildForm(data: UserResponse): void {
    this.form = this.fb.group({
      firstName: [data.firstName || ''],
      lastName: [data.lastName || ''],
      email: [data.email, [Validators.required, Validators.email]],
      phone: [data.phone || ''],
    });
    const phone = this.form.get('phone');
    if (data.role === 'CUSTOMER') phone?.setValidators([Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]);
    else phone?.clearValidators();
    phone?.updateValueAndValidity();
  }

  getFullName(user: UserResponse): string {
    const first = user.firstName || '';
    const last = user.lastName || '';
    return (first + ' ' + last).trim() || user.username;
  }

  getInitials(user: UserResponse): string {
    const first = user.firstName?.[0] || '';
    const last = user.lastName?.[0] || '';
    const username = user.username?.[0] || '';
    return (first + last || username).toUpperCase();
  }

  getStatus(user: UserResponse): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; class?: string } {
    if (!user.enabled) return { label: 'Unverified', variant: 'secondary', class: 'bg-warning-soft text-warning' };
    if (!user.active) return { label: 'Blocked', variant: 'destructive' };
    return { label: 'Active', variant: 'default' };
  }

  isSelf(user: UserResponse): boolean {
    return String(this.auth.currentUser()?.id) === String(user.id);
  }

  permissionCount(user: UserResponse): number { return user.permissions?.length ?? 0; }

  openEditDialog(): void { this.showEditDialog.set(true); }
  closeEditDialog(): void { this.showEditDialog.set(false); }

  saveChanges(): void {
    const u = this.user();
    if (!u || this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.value;
    const req: UserRequest = {
      email: v.email, phone: v.phone, firstName: v.firstName || undefined, lastName: v.lastName || undefined,
    };
    this.userService.update(u.id, req).pipe(
      tap(() => this.saving.set(false)),
      catchError((err) => { this.saving.set(false); this.error.set(err?.error?.message || 'Failed to save'); return of(null); }),
    ).subscribe((res) => {
      if (res?.data) { this.user.set(res.data); this.buildForm(res.data); this.showEditDialog.set(false); this.breadcrumbService.updateLastLabel(this.getFullName(res.data)); }
    });
  }

  toggleBlock(): void {
    const u = this.user();
    if (!u || this.isSelf(u)) return;
    this.blocking.set(u);
  }

  confirmBlock(): void {
    const u = this.blocking();
    if (!u) return;
    this.userService.toggleActive(u.id).subscribe({
      next: (res) => { this.blocking.set(null); if (res?.data) this.user.set(res.data); },
      error: (err) => { this.blocking.set(null); this.error.set(err?.error?.message || 'Failed'); },
    });
  }

  delete(): void {
    const u = this.user();
    if (!u || this.isSelf(u)) return;
    this.deleting.set(u);
    this.deleteConfirmText.set('');
  }

  confirmDelete(): void {
    const u = this.deleting();
    if (!u || this.deleteConfirmText() !== u.username) return;
    this.userService.delete(u.id).subscribe({
      next: () => { this.deleting.set(null); this.router.navigate(['/dashboard/users']); },
      error: (err) => { this.deleting.set(null); this.error.set(err?.error?.message || 'Failed'); },
    });
  }

  openRoleDialog(): void {
    const u = this.user();
    if (!u || !this.canChangeRole()) return;
    this.newRole.set(u.role);
    this.roleConfirmText.set('');
    this.showRoleDialog.set(true);
  }
  closeRoleDialog(): void { this.showRoleDialog.set(false); }

  roleLabel(name: string): string {
    const key = `users.roleNames.${name}`;
    const translated = this.transloco.translate(key);
    if (typeof translated === 'string' && translated && translated !== key) return translated;
    return humanize(name);
  }

  roleDescription(role: RoleResponse | null): string {
    if (!role) return '';
    if (role.system) {
      const key = `users.roleDescriptions.${role.name}`;
      const translated = this.transloco.translate(key);
      if (typeof translated === 'string' && translated && translated !== key) return translated;
    }
    return role.description && role.description !== role.name ? role.description : '';
  }

  /** "Product · Edit" — readable in a list, still unambiguous. */
  permissionLabel(slug: string): string {
    const { resource } = parsePermission(slug);
    const key = `permissions.resources.${resource}`;
    const translated = this.transloco.translate(key);
    const resourceText =
      typeof translated === 'string' && translated && translated !== key
        ? translated
        : humanize(resource);
    return `${resourceText} · ${actionLabel(slug)}`;
  }

  diffSummaryLabel(): string {
    const diff = this.roleDiff();
    return this.transloco.translate('users.roleChange.diffSummary', {
      granted: diff.granted.length,
      revoked: diff.revoked.length,
    });
  }

  confirmRoleChange(): void {
    const u = this.user();
    const target = this.targetRole();
    if (!u || !target || target.name === u.role || !this.canChangeRole()) return;
    if (this.requiresUsername() && this.roleConfirmText() !== u.username) return;
    this.saving.set(true);
    this.userService.changeRole(u.id, target.name).pipe(
      tap(() => this.saving.set(false)),
      catchError((err) => {
        this.saving.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not change the role');
        return of(null);
      }),
    ).subscribe((res) => {
      if (res?.data) {
        this.user.set(res.data);
        this.showRoleDialog.set(false);
        this.notify.success('users.roleChange.changed', 'Role changed');
      }
    });
  }
  goBack(): void { this.router.navigate(['/dashboard/users']); }
}
