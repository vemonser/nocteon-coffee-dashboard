// shared/components/user-menu/user-menu.component.ts
import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronsUpDown,
  lucideUser,
  lucideBell,
  lucideLogOut,
} from '@ng-icons/lucide';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { TranslocoPipe } from '@jsverse/transloco';

import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { HlmSidebarService } from '@spartan-ng/helm/sidebar';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgIcon,
    HlmAvatarImports,
    HlmSidebarImports,
    HlmDropdownMenuImports,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideChevronsUpDown,
      lucideUser,
      lucideBell,
      lucideLogOut,
    }),
  ],
  templateUrl: './user-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  @Input() variant: 'sidebar' | 'navbar' = 'navbar';

  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly _sidebarService = inject(HlmSidebarService);

  protected readonly _menuSide = computed(() =>
    this._sidebarService.isMobile() ? 'top' : 'right',
  );

  readonly currentDir = computed(() =>
    this.language.current() === 'ar' ? 'rtl' : 'ltr',
  );

  getInitial(): string {
    const name = this.auth.getFullName();
    return name ? name.charAt(0).toUpperCase() : 'A';
  }

  onLogout(): void {
    this.auth.logout().subscribe();
  }
}