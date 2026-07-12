import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCommand,
  lucideLayoutDashboard,
  lucidePackage,
  lucideUsers,
  lucideStar,
  lucideBookOpen,
  lucideCoffee,
  lucideTags,
  lucideGlobe,
  lucideSprout,
  lucideFlame,
  lucideSettings2,
  lucideGitBranch,
  lucideDroplets,
  lucideFlaskConical,
  lucideUtensilsCrossed,
} from '@ng-icons/lucide';
import { HlmSidebarImports, HlmSidebarService } from '@spartan-ng/helm/sidebar';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmSeparator } from '@spartan-ng/helm/separator';

import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { getNavItems } from '../../../shared/data/sidebar-nav-items';
import { UserMenuComponent } from '../../../shared/ui/user-menu/user-menu.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HlmSidebarImports,
    NgIcon,
    HlmSeparator,
    UserMenuComponent,
  ],
  providers: [
    provideIcons({
      lucideCommand,
      lucideLayoutDashboard,
      lucidePackage,
      lucideUsers,
      lucideStar,
      lucideBookOpen,
      lucideCoffee,
      lucideTags,
      lucideGlobe,
      lucideSprout,
      lucideFlame,
      lucideSettings2,
      lucideGitBranch,
      lucideDroplets,
      lucideFlaskConical,
      lucideUtensilsCrossed,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent {
  private readonly _sidebarService = inject(HlmSidebarService);
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);

  protected readonly _menuSide = computed(() =>
    this._sidebarService.isMobile() ? 'top' : 'right',
  );

  private readonly _navItems = computed(() => getNavItems(this.language.current()));
  readonly mainNav = computed(() => this._navItems().main);
  readonly catalogNav = computed(() => this._navItems().catalog);
}