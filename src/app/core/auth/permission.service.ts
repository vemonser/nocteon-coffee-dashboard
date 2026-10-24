import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private auth = inject(AuthService);
  private perms = computed(() => new Set(this.auth.currentUser()?.permissions ?? []));
  has(slug: string): boolean {
    const user = this.auth.currentUser();
    if (user?.role === 'ADMIN') return true;
    return this.perms().has(slug);
  }
  hasSignal(slug: string) {
    return computed(() => this.has(slug));
  }
}
