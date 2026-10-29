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
  lucideScrollText,
  lucideChevronDown,
} from '@ng-icons/lucide';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmSeparator } from '@spartan-ng/helm/separator';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NavCountsService, type NavBadge } from '../../../core/nav/nav-counts.service';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { HlmSidebarService } from '@spartan-ng/helm/sidebar';
import {
  getNavItems,
  sectionKeyForRoute,
  type NavSectionKey,
} from '../../../shared/data/sidebar-nav-items';
import type { NavItem } from '../../../shared/data/sidebar-nav-items.model';
import { UserMenuComponent } from '../../../shared/ui/user-menu/user-menu.component';

/**
 * One rendered section (FE-25 D4+A).
 *
 * `rows` are the links that sit DIRECTLY under the section heading: the children of
 * the section's (single, implicit) parent, or the parent itself when it has none.
 * The section label is rendered ONCE — as the heading — and the old parent row that
 * duplicated that label is gone.
 */
export interface SidebarSectionView {
  key: NavSectionKey;
  label: string;
  rows: NavItem[];
}

/**
 * Persisted section state.
 *
 * The KEY changed with D4+A: sections are the collapsible unit now, so the stored
 * values are section keys ('catalog'), not the routes of the old parent rows
 * ('/dashboard/products'). A list left over from the old structure parses fine and
 * matches no section, so it opens nothing — which is the safe reading.
 */
const SECTIONS_OPEN_KEY = 'nocteon-sidebar-sections-open';

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
    TranslocoPipe,
    PluralPipe,
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
      lucideScrollText,
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

  protected badgeFor(route: string): NavBadge | null {
    return this.navCounts.badgeFor(route);
  }
  protected isRailCollapsed(): boolean {
    return this.sidebar.state() === 'collapsed';
  }

  /** Expanded/collapsed state of each section, keyed by the section key. */
  protected readonly openSections = signal<Set<NavSectionKey>>(this.loadOpenSections());

  private readonly navContainer = viewChild.required<ElementRef<HTMLElement>>('nav');

  private readonly _navItems = computed(() => getNavItems(this.language.current()));

  protected readonly dashboardItem = computed(() => this._navItems().dashboard);

  /**
   * Sections with permission filtering applied, flattened to the rows that render
   * under each heading. A section whose rows are all filtered out is dropped, so a
   * heading is never rendered empty.
   */
  protected readonly sections = computed<SidebarSectionView[]>(() =>
    this._navItems()
      .sections.map((section) => ({
        key: section.key,
        label: section.label,
        rows: section.items.flatMap((parentItem) => {
          // A parent WITH children is only a permission gate: when none of its
          // children is permitted the section has nothing to show, and it is
          // dropped. Falling back to the parent row here would put the section
          // name back on screen as a link — the duplicate D4+A removed.
          if (parentItem.children && parentItem.children.length > 0) {
            return parentItem.children.filter((child) => this.canSee(child));
          }
          return this.canSee(parentItem) ? [parentItem] : [];
        }),
      }))
      .filter((section) => section.rows.length > 0),
  );

  constructor() {
    // RouterLinkActive sets aria-current="page" on the active link, which is the only
    // reliable way to find it across the sections.
    this._router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.autoOpenForUrl(this._router.url);
        this.scrollActiveIntoView();
      });

    // First paint: open the section holding the current page instead of everything.
    this.autoOpenForUrl(this._router.url);

    effect(() => {
      // Re-run when the nav re-renders (language switch, permission change).
      this.sections();
      this.scrollActiveIntoView();
    });
  }

  /** The id of a section's heading button — the disclosure control. */
  protected headingId(key: NavSectionKey): string {
    return `sidebar-section-${key}-heading`;
  }

  /** The id of the panel the heading controls (its `aria-controls` target). */
  protected panelId(key: NavSectionKey): string {
    return `sidebar-section-${key}-panel`;
  }

  /** Toggle one section open or closed. */
  protected toggleSection(key: NavSectionKey): void {
    const next = new Set(this.openSections());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.openSections.set(next);
    this.persistOpenSections();
  }

  /** Is this section's panel collapsed? */
  protected isSectionCollapsed(key: NavSectionKey): boolean {
    return !this.openSections().has(key);
  }

  private canSee(item: NavItem): boolean {
    return !item.permission || this.auth.hasPermission(item.permission);
  }

  /**
   * Opens the section holding the current route. Other sections are left as the
   * reader left them — auto-opening is a first-paint cue, not a reset.
   */
  private autoOpenForUrl(url: string): void {
    const key = sectionKeyForRoute(url);
    if (!key) return;
    if (this.openSections().has(key)) return;
    this.openSections.update((s) => new Set([...s, key]));
    this.persistOpenSections();
  }

  private persistOpenSections(): void {
    try {
      const sections = Array.from(this.openSections());
      if (sections.length > 0) {
        localStorage.setItem(SECTIONS_OPEN_KEY, JSON.stringify(sections));
      } else {
        localStorage.removeItem(SECTIONS_OPEN_KEY);
      }
    } catch {
      /* storage unavailable */
    }
  }

  private loadOpenSections(): Set<NavSectionKey> {
    try {
      const saved = localStorage.getItem(SECTIONS_OPEN_KEY);
      if (!saved) return new Set();
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return new Set();
      // Only keys this nav knows (derived from the nav itself, so a new section
      // needs no second list to stay restorable): an entry from an older
      // structure is not a section.
      const known = new Set<NavSectionKey>(getNavItems('en').sections.map((section) => section.key));
      return new Set(parsed.filter((key): key is NavSectionKey => known.has(key as NavSectionKey)));
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
