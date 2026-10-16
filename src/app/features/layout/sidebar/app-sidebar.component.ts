import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
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
  lucideBellRing,
  lucideGlobe,
  lucideSprout,
  lucideFlame,
  lucideSettings2,
  lucideGitBranch,
  lucideDroplets,
  lucideFlaskConical,
  lucideShoppingCart,
  lucideShoppingBag,
  lucideFactory,
  lucideUtensilsCrossed,
  lucideSlidersHorizontal,
  lucideMegaphone,
  lucideMail,
} from '@ng-icons/lucide';
import { HlmSidebarImports, HlmSidebarService } from '@spartan-ng/helm/sidebar';
import { HlmSeparator } from '@spartan-ng/helm/separator';
import { filter } from 'rxjs';

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
      lucideBellRing,
      lucideTags,
      lucideGlobe,
      lucideSprout,
      lucideFlame,
      lucideSettings2,
      lucideGitBranch,
      lucideDroplets,
      lucideFlaskConical,
      lucideShoppingCart,
      lucideShoppingBag,
      lucideFactory,
      lucideUtensilsCrossed,
      lucideSlidersHorizontal,
      lucideMegaphone,
      lucideMail,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent {
  private readonly _sidebarService = inject(HlmSidebarService);
  private readonly _router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);

  private readonly navContainer = viewChild.required<ElementRef<HTMLElement>>('nav');

  protected readonly _menuSide = computed(() =>
    this._sidebarService.isMobile() ? 'top' : 'right',
  );

  private readonly _navItems = computed(() => getNavItems(this.language.current()));

  protected readonly dashboardItem = computed(() => this._navItems().dashboard);

  /** Sections with permission filtering applied, so a filtered-out item is never rendered. */
  protected readonly sections = computed(() =>
    this._navItems()
      .sections.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => !item.permission || this.auth.hasPermission(item.permission),
        ),
      }))
      .filter((section) => section.items.length > 0),
  );

  constructor() {
    // RouterLinkActive sets aria-current="page" on the active link, which is the only
    // reliable way to find it across the groups.
    this._router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.scrollActiveIntoView());

    effect(() => {
      // Re-run when the nav re-renders (language switch, permission change).
      this.sections();
      this._menuSide();
      this.scrollActiveIntoView();
    });
  }

  private scrollActiveIntoView(): void {
    // After render so the link exists; block:'nearest' avoids a jump when everything fits.
    setTimeout(() => {
      const active = this.navContainer()
        .nativeElement.querySelector<HTMLElement>('a[aria-current="page"]');
      active?.scrollIntoView({ block: 'nearest' });
    });
  }
}