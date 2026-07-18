import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSkeletonImports } from '@spartan-ng/helm/skeleton';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideCheck,
  lucideLoader2,
  lucideLock,
  lucideMail,
  lucidePencil,
  lucideShield,
  lucideUnlock,
  lucideUser,
  lucideX,
} from '@ng-icons/lucide';

import { catchError, map, of, switchMap, tap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { UserService } from '../../services/user.service';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';
import { UserRequest, UserResponse } from '../../model/user.model';
import { HasPermissionDirective } from '../../../../core/auth/permission.directive';

type EditMode = 'view' | 'edit';
type RoleOption = 'CUSTOMER' | 'ADMIN' | 'MODERATOR';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    CommonModule,
    HasPermissionDirective,
    FormsModule,
    ReactiveFormsModule,
    HlmCardImports,
    HlmButtonImports,
    HlmBadgeImports,
    HlmInputImports,
    HlmSelectImports,
    HlmLabelImports,
    HlmSkeletonImports,
    HlmSeparatorImports,
    HlmAvatarImports,
    NgIcon,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucidePencil,
      lucideLock,
      lucideUnlock,
      lucideCheck,
      lucideX,
      lucideLoader2,
      lucideUser,
      lucideShield,
      lucideMail,
    }),
  ],
  templateUrl: './user-detail.component.html',
})
export class UserDetailComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private breadcrumbService = inject(BreadcrumbService);

  readonly user = signal<UserResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly togglingActive = signal(false);
  readonly error = signal<string | null>(null);
  readonly mode = signal<EditMode>('view');

  readonly roleOptions: { label: string; value: RoleOption }[] = [
    { label: 'Customer', value: 'CUSTOMER' },
    { label: 'Moderator', value: 'MODERATOR' },
    { label: 'Admin', value: 'ADMIN' },
  ];

  form!: FormGroup;

  readonly isEditing = computed(() => this.mode() === 'edit');
  readonly isDirty = signal(false);

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        switchMap((id) => {
          if (!id) {
            this.error.set('User not found');
            return of(null);
          }
          this.loading.set(true);
          return this.userService.getById(id).pipe(
            catchError((err) => {
              this.error.set(err?.error?.message || 'Failed to load user');
              return of(null);
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (res?.data) {
          this.user.set(res.data);
          this.buildForm(res.data);
          this.breadcrumbService.updateLastLabel(res.data.username);
        }
      });
  }

  private buildForm(data: UserResponse): void {
    this.form = this.fb.group({
      username: [data.username, [Validators.required, Validators.minLength(3)]],
      email: [data.email, [Validators.required, Validators.email]],
      role: [data.role, Validators.required],
      firstName: [data.firstName || ''],
      lastName: [data.lastName || ''],
      phone: [''],
    });

    this.isDirty.set(false);
    this.form.valueChanges.subscribe(() => this.isDirty.set(this.form.dirty));
  }

  getFullName(user: UserResponse): string {
    const first = user.firstName || '';
    const last = user.lastName || '';
    return (first + ' ' + last).trim() || '—';
  }

  getInitials(user: UserResponse): string {
    const first = user.firstName?.[0] || '';
    const last = user.lastName?.[0] || '';
    const username = user.username?.[0] || '';
    return (first + last || username).toUpperCase();
  }

  getStatus(user: UserResponse): {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    class?: string;
  } {
    if (!user.enabled) {
      return {
        label: 'Unverified',
        variant: 'secondary',
        class: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
      };
    }
    if (!user.active) {
      return { label: 'Blocked', variant: 'destructive' };
    }
    return { label: 'Active', variant: 'default' };
  }

  // ─── Edit Actions ──────────────────────────────────────────────────────────

  startEdit(): void {
    this.mode.set('edit');
  }

  cancelEdit(): void {
    const data = this.user();
    if (data) this.buildForm(data);
    this.mode.set('view');
  }

  saveChanges(): void {
    if (this.form.invalid) return;

    const id = this.user()?.id;
    if (!id) return;

    this.saving.set(true);

    const v = this.form.value;
    const req: UserRequest = {
      username: v.username,
      email: v.email,
      phone: v.phone,
      role: v.role,
      firstName: v.firstName || undefined,
      lastName: v.lastName || undefined,
    };

    this.userService
      .update(id, req)
      .pipe(
        tap(() => this.saving.set(false)),
        catchError((err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message || 'Failed to save');
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res?.data) {
          this.user.set(res.data);
          this.mode.set('view');
          this.form.markAsPristine();
          this.breadcrumbService.updateLastLabel(res.data.username);
        }
      });
  }

  toggleActive(): void {
    const user = this.user();
    if (!user) return;

    const action = user.active ? 'block' : 'unblock';
    if (!confirm(`Are you sure you want to ${action} "${user.username}"?`)) return;

    this.togglingActive.set(true);
    this.userService.toggleActive(user.id).subscribe({
      next: (res) => {
        this.togglingActive.set(false);
        if (res?.data) this.user.set(res.data);
      },
      error: (err) => {
        this.togglingActive.set(false);
        this.error.set(err?.error?.message || 'Failed to update status');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/users']);
  }
}
