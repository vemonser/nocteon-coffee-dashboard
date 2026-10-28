import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
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
  lucideTag,
  lucideMegaphone,
  lucideMail,
  lucideChevronDown,
} from '@ng-icons/lucide';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmSeparator } from '@spartan-ng/helm/separator';
import { filter } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NavCountsService } from '../../../core/nav/nav-counts.service';
import { HlmSidebarService } from '@spartan-ng/helm/sidebar';
import { getNavItems, sectionKeyForRoute } from '../../../shared/data/sidebar-nav-items';
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
      lucideTag,
      lucideMegaphone,
      lucideMail,
      lucideChevronDown,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app-sidebar.component.css',
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent {
  private readonly _router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  protected readonly navCounts = inject(NavCountsService);
  protected readonly sidebar = inject(HlmSidebarService);

  protected badgeCount(route: string): number | null {
    return this.navCounts.badgeFor(route);
  }
  protected badgeAria(route: string, n: number): string {
    return this.navCounts.ariaLabel(route, n);
  }
  protected isRailCollapsed(): boolean {
    return this.sidebar.state() === 'collapsed';
  }

  private readonly ITEM_OPEN_KEY = 'nocteon-sidebar-item-open';

  /** Track expanded/collapsed state for parent nav items with children. */
  protected readonly openItems = signal<Set<string>>(this.loadOpenItems());

  private readonly navContainer = viewChild.required<ElementRef<HTMLElement>>('nav');

  private readonly _navItems = computed(() => getNavItems(this.language.current()));

  protected readonly dashboardItem = computed(() => this._navItems().dashboard);

  /** Sections with permission filtering applied, so a filtered-out item is never rendered. */
  protected readonly sections = computed(() =>
    this._navItems()
      .sections.map((section) => ({
        ...section,
        items: section.items
          .map((parentItem) => {
            if (parentItem.children && parentItem.children.length > 0) {
              const visibleChildren = parentItem.children.filter(
                (child) => !child.permission || this.auth.hasPermission(child.permission),
              );
              if (visibleChildren.length === 0) return null;
              return { ...parentItem, children: visibleChildren };
            }
            return !parentItem.permission || this.auth.hasPermission(parentItem.permission)
              ? parentItem
              : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      }))
      .filter((section) => section.items.length > 0),
  );

  constructor() {
    // RouterLinkActive sets aria-current="page" on the active link, which is the only
    // reliable way to find it across the groups.
    this._router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.autoOpenForUrl(this._router.url);
        this.scrollActiveIntoView();
      });

    // First paint: open the current page's group instead of everything.
    this.autoOpenForUrl(this._router.url);

    effect(() => {
      // Re-run when the nav re-renders (language switch, permission change).
      this.sections();
      this.scrollActiveIntoView();
    });
  }

  /** Toggle a parent nav item's children. */
  protected toggleItem(route: string): void {
    const next = new Set(this.openItems());
    if (next.has(route)) {
      next.delete(route);
    } else {
      next.add(route);
    }
    this.openItems.set(next);
    this.persistOpenItems();
  }

  /** Check if a parent item's children are collapsed. */
  protected isItemCollapsed(route: string): boolean {
    return !this.openItems().has(route);
  }

  /** Opens the group holding the current route; closes the rest. */
  private autoOpenForUrl(url: string): void {
    // Also auto-open the parent item if the route is a child
    const navItems = getNavItems('en');
    for (const section of navItems.sections) {
      for (const item of section.items) {
        if (item.children?.some((child) => url.startsWith(child.route))) {
          this.openItems.update((s) => new Set([...s, item.route]));
          this.persistOpenItems();
          break;
        }
      }
    }
  }

  private persistOpenItems(): void {
    try {
      const items = Array.from(this.openItems());
      if (items.length > 0) {
        localStorage.setItem(this.ITEM_OPEN_KEY, JSON.stringify(items));
      } else {
        localStorage.removeItem(this.ITEM_OPEN_KEY);
      }
    } catch {
      /* storage unavailable */
    }
  }

  private loadOpenItems(): Set<string> {
    try {
      const saved = localStorage.getItem(this.ITEM_OPEN_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
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