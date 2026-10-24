import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePlus, lucideShield } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { UserService } from '../../services/user.service';
import { PermissionMatrixComponent } from '../../../../shared/components/permission-matrix/permission-matrix.component';
import { ALL_PERMISSIONS } from '../../../../shared/utils/permission.utils';

@Component({
  selector: 'app-roles-list',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmInputImports, NgIcon, TranslocoPipe, PermissionMatrixComponent],
  providers: [provideIcons({ lucidePlus, lucideShield })],
  templateUrl: './roles-list.component.html',
})
export class RolesListComponent implements OnInit {
  private userService = inject(UserService);
  private router = inject(Router);
  roles = signal<string[]>([]);
  selectedRole = signal<string | null>(null);
  usersByRole = signal<Record<string, number>>({});
  readonly allPermissions = ALL_PERMISSIONS;

  ngOnInit(): void {
    this.userService.getRoles().subscribe({ next: (r) => { if (r?.data?.length) this.roles.set(r.data); } });
    this.userService.getAll({ size: 200 }).subscribe({ next: (r) => {
      const counts: Record<string, number> = {};
      for (const u of r.data.content) counts[u.role] = (counts[u.role] ?? 0) + 1;
      this.usersByRole.set(counts);
    }});
  }

  select(role: string): void { this.selectedRole.set(role); }
  isSystem(role: string): boolean { return ['ADMIN','MODERATOR','CUSTOMER'].includes(role); }
  userCount(role: string): number { return this.usersByRole()[role] ?? 0; }
}
