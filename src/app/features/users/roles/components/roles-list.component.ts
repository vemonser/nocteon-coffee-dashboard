import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck, lucideLoader2, lucideLock, lucidePencil, lucidePlus, lucideShield,
  lucideTrash2, lucideX,
} from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { pluralKey } from '../../../../core/i18n/plural';
import { NotifyService } from '../../../../core/notify/notify.service';
import { BreadcrumbService } from '../../../../shared/components/breadcrumb/service/breadcrumb.service';
import { PermissionMatrixComponent } from '../../../../shared/components/permission-matrix/permission-matrix.component';
import { ALL_PERMISSIONS, humanize } from '../../../../shared/utils/permission.utils';
import { RoleResponse } from '../../model/user.model';
import { UserService } from '../../services/user.service';

const ROLE_NAME_PATTERN = /^[A-Z][A-Z0-9_]{2,31}$/;

/**
 * The roles console.
 *
 * The selected role is a URL segment (`/users/roles/:roleName`) rather than
 * component state: a role is then linkable, survives a reload, and Back
 * returns to the role the reader was inspecting instead of closing a panel.
 */
@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink, HlmBadgeImports,
    HlmButtonImports, HlmInputImports, HlmLabelImports, HlmNativeSelectImports, NgIcon,
    TranslocoPipe, PermissionMatrixComponent,
  ],
  providers: [provideIcons({
    lucidePlus, lucideShield, lucideLock, lucidePencil, lucideTrash2, lucideX, lucideCheck,
    lucideLoader2,
  })],
  templateUrl: './roles-list.component.html',
})
export class RolesListComponent implements OnInit {
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private breadcrumb = inject(BreadcrumbService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);
  private transloco = inject(TranslocoService);
  private language = inject(LanguageService);
  private fb = inject(FormBuilder);

  readonly allPermissions = ALL_PERMISSIONS;

  roles = signal<RoleResponse[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  /** `GET /roles` is also the probe for whether custom roles exist at all. */
  rolesEndpointAvailable = signal(true);

  selectedName = signal<string | null>(null);
  selected = computed(() => this.roles().find((r) => r.name === this.selectedName()) ?? null);

  /** Custom-role editing needs a custom role, the endpoint, and `role:manage`. */
  canManageRoles = computed(() => this.auth.hasPermission('role:manage'));

  editing = signal(false);
  draft = signal<string[]>([]);
  saving = signal(false);

  readonly roleDiffSummary = computed(() => {
    const role = this.selected();
    if (!role || !this.editing()) return null;
    const before = new Set(role.permissions || []);
    const after = new Set(this.draft());
    let granted = 0;
    let revoked = 0;
    for (const p of after) if (!before.has(p)) granted++;
    for (const p of before) if (!after.has(p)) revoked++;
    return { granted, revoked };
  });

  showCreate = signal(false);
  createForm!: FormGroup;
  creating = signal(false);

  deleting = signal<RoleResponse | null>(null);
  deleteError = signal<string | null>(null);

  ngOnInit(): void {
    this.createForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(ROLE_NAME_PATTERN)]],
      description: [''],
      cloneFrom: ['CUSTOMER'],
    });

    this.route.paramMap.subscribe((params) => {
      const name = params.get('roleName');
      this.editing.set(false);
      this.selectedName.set(name);
      if (name) this.breadcrumb.appendCrumb(this.displayNameByName(name));
    });

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.userService.getRoles().subscribe({
      next: (res) => {
        this.loading.set(false);
        const roles = res?.data ?? [];
        this.rolesEndpointAvailable.set(true);
        this.roles.set(roles);
        this.resolveSelection(roles);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
        this.rolesEndpointAvailable.set(false);
      },
    });
  }

  /**
   * Defaults to the FIRST role (Admin) and rewrites the URL so the address
   * always names the role on screen.
   */
  private resolveSelection(roles: RoleResponse[]): void {
    if (!roles.length) return;
    const requested = this.selectedName();
    const match = requested ? roles.find((r) => r.name === requested) : null;
    const chosen = match ?? roles[0];
    if (chosen.name !== requested || !match) {
      this.router.navigate(['/dashboard/users/roles', chosen.name], { replaceUrl: true });
    }
    this.selectedName.set(chosen.name);
    this.breadcrumb.appendCrumb(this.displayName(chosen));
  }

  select(name: string): void {
    if (name === this.selectedName()) return;
    this.router.navigate(['/dashboard/users/roles', name]);
  }

  isSelected(role: RoleResponse): boolean {
    return role.name === this.selectedName();
  }

  displayName(role: RoleResponse): string {
    return this.displayNameByName(role.name);
  }

  displayNameByName(name: string): string {
    const key = `users.roleNames.${name}`;
    const translated = this.transloco.translate(key);
    if (typeof translated === 'string' && translated && translated !== key) return translated;
    return humanize(name);
  }

  description(role: RoleResponse): string {
    if (role.system) {
      const key = `users.roleDescriptions.${role.name}`;
      const translated = this.transloco.translate(key);
      if (typeof translated === 'string' && translated && translated !== key) return translated;
    }
    return role.description && role.description !== role.name ? role.description : '';
  }

  userCountLabel(count: number): string {
    return this.transloco.translate(pluralKey('users.roleCard.users', count, this.language.current()), { count });
  }

  permissionCountLabel(count: number): string {
    return this.transloco.translate('users.roleCard.permissions', { count });
  }

  selectLabel(role: RoleResponse): string {
    return this.transloco.translate('users.rolesPage.selectRole', { name: this.displayName(role) });
  }

  /** The matrix for a role is read-only unless the role is custom AND editable. */
  canEdit(role: RoleResponse): boolean {
    return !role.system && this.rolesEndpointAvailable() && this.canManageRoles();
  }

  startEdit(): void {
    const role = this.selected();
    if (!role || !this.canEdit(role)) return;
    this.draft.set([...role.permissions]);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.draft.set([]);
  }

  toggleDraft(permissions: Set<string>): void {
    this.draft.set([...permissions]);
  }

  savePermissions(): void {
    const role = this.selected();
    if (!role || !this.canEdit(role) || this.saving()) return;
    this.saving.set(true);
    this.userService.updateRole(role.name, { permissions: this.draft() }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.editing.set(false);
        if (res?.data) {
          this.roles.update((list) => list.map((r) => (r.name === res.data.name ? res.data : r)));
        }
        this.notify.success('users.rolesPage.saved', 'Permissions saved');
      },
      error: (err) => {
        this.saving.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not save permissions');
      },
    });
  }

  openCreate(): void {
    if (!this.rolesEndpointAvailable() || !this.canManageRoles()) return;
    this.createForm.reset({ name: '', description: '', cloneFrom: 'CUSTOMER' });
    this.showCreate.set(true);
  }

  closeCreate(): void {
    this.showCreate.set(false);
  }

  submitCreate(): void {
    if (this.createForm.invalid || this.creating()) return;
    const v = this.createForm.getRawValue();
    this.creating.set(true);
    this.userService.createRole({
      name: v.name,
      description: v.description || null,
      cloneFrom: v.cloneFrom || null,
    }).subscribe({
      next: (res) => {
        this.creating.set(false);
        const created = res?.data;
        if (!created) return;
        this.showCreate.set(false);
        this.roles.update((list) => [...list, created]);
        this.notify.success('users.rolesPage.created', 'Role created');
        this.router.navigate(['/dashboard/users/roles', created.name]);
      },
      error: (err) => {
        this.creating.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not create the role');
      },
    });
  }

  askDelete(): void {
    const role = this.selected();
    if (!role || role.system || !this.canManageRoles()) return;
    this.deleteError.set(null);
    this.deleting.set(role);
  }

  confirmDelete(): void {
    const role = this.deleting();
    if (!role) return;
    this.userService.deleteRole(role.name).subscribe({
      next: () => {
        this.deleting.set(null);
        this.roles.update((list) => list.filter((r) => r.name !== role.name));
        this.notify.success('users.rolesPage.deleted', 'Role deleted');
        const next = this.roles()[0];
        if (next) this.router.navigate(['/dashboard/users/roles', next.name]);
        else this.router.navigate(['/dashboard/users/roles']);
      },
      error: (err) => {
        this.deleteError.set(err?.error?.message || 'Could not delete the role');
      },
    });
  }

  retry(): void {
    this.loadFailed.set(false);
    this.load();
  }

  canDeactivate(): boolean {
    if (!this.editing()) return true;
    const role = this.selected();
    if (!role) return true;
    const before = new Set(role.permissions || []);
    const after = new Set(this.draft());
    let changed = before.size !== after.size;
    if (!changed) for (const p of before) if (!after.has(p)) { changed = true; break; }
    if (!changed) return true;
    return true; // global guard handles unsaved changes
  }

  /** Guards the "New role" affordance: missing endpoint OR missing authority. */
  get newRoleUnavailable(): boolean {
    return !this.rolesEndpointAvailable() || !this.canManageRoles();
  }

  get newRoleTooltip(): string {
    if (!this.rolesEndpointAvailable()) {
      return this.transloco.translate('users.rolesPage.newRoleUnavailable');
    }
    return '';
  }
}
