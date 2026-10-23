import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft, lucideCheck, lucideLoader2, lucideLock, lucideMail, lucidePencil,
  lucideShield, lucideTrash2, lucideUnlock, lucideUser, lucideX, lucideBadgeCheck,
} from '@ng-icons/lucide';

import { UserService } from '../../services/user.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';
import { UserRequest, UserResponse } from '../../model/user.model';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocalizedDateComponent } from '../../../../shared/ui/localized-date/localized-date.component';
import { PermissionMatrixComponent } from '../../../../shared/components/permission-matrix/permission-matrix.component';
import { ALL_PERMISSIONS } from '../../../../shared/utils/permission.utils';
import { NotifyService } from '../../../../core/notify/notify.service';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    LocalizedDateComponent, CommonModule, FormsModule, ReactiveFormsModule,
    HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmInputImports, HlmLabelImports,
    HlmSkeletonImports, HlmSeparatorImports, HlmAvatarImports, HlmNativeSelectImports, HlmDropdownMenuImports, NgIcon, TranslocoPipe, PermissionMatrixComponent,
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
  readonly roleOptions = signal<string[]>([]);
  readonly allPermissions = ALL_PERMISSIONS;

  form!: FormGroup;

  ngOnInit(): void {
    this.userService.getRoles().subscribe({ next: (r) => { if (r?.data?.length) this.roleOptions.set(r.data); } });
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

  openRoleDialog(): void { const u=this.user(); if(!u) return; this.newRole.set(u.role); this.roleConfirmText.set(''); this.showRoleDialog.set(true); }
  closeRoleDialog(): void { this.showRoleDialog.set(false); }
  confirmRoleChange(): void {
    const u=this.user(); if(!u || this.newRole()===u.role) return;
    if (this.newRole()==='ADMIN' && this.roleConfirmText()!==u.username) return;
    this.saving.set(true);
    this.userService.update(u.id, { role: this.newRole() }).pipe(
      tap(()=>this.saving.set(false)),
      catchError((err)=>{ this.saving.set(false); this.error.set(err?.error?.message||'Failed'); return of(null); }),
    ).subscribe((res)=>{ if(res?.data){ this.user.set(res.data); this.showRoleDialog.set(false); } });
  }
  goBack(): void { this.router.navigate(['/dashboard/users']); }
}
