import { Injectable, signal, computed, effect, untracked } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { Breadcrumb } from '../model/breadcrumb.model';
import { LanguageService } from '../../../../core/i18n/language.service';
import { navI18n, NavKey } from '../../../i18n/nav-i18n';
import { sectionKeyForRoute, sectionLabel } from '../../../data/sidebar-nav-items';

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private breadcrumbs = signal<Breadcrumb[]>([]);
  readonly items = computed(() => this.breadcrumbs());

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private languageService: LanguageService,
  ) {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.rebuild());

    effect(() => {
      this.languageService.language();
      this.rebuild();
    });
  }

  private rebuild(): void {
    this.breadcrumbs.set(this.buildBreadcrumbs());
    this.applyLastLabelOverride();
  }

  /**
   * Detail pages override the last crumb with the entity's own name
   * (`updateLastLabel`). A rebuild — every navigation AND every language
   * switch — regenerates the trail from the static route data ("Category"),
   * so the override must be remembered and re-applied, or the language
   * toggle would throw the entity name away. The override is scoped to the
   * URL it was set on and cleared as soon as the user leaves that view.
   */
  private lastLabelOverride = signal<{ url: string; label: string } | null>(null);

  private applyLastLabelOverride(): void {
    // This runs from the language-change effect, which already writes
    // `breadcrumbs` — reading signals back inside that effect would track
    // them and turn the write→read into an infinite synchronous loop.
    untracked(() => {
      const override = this.lastLabelOverride();
      if (!override) return;
      if (override.url !== this.currentPathUrl()) {
        this.lastLabelOverride.set(null);
        return;
      }
      const current = this.breadcrumbs();
      if (current.length === 0) return;
      const updated = [...current];
      updated[updated.length - 1] = { ...updated[updated.length - 1], label: override.label };
      this.breadcrumbs.set(updated);
    });
  }

  /** router.url without query/hash — the segments the trail is built from. */
  private currentPathUrl(): string {
    return this.router.url.split('?')[0].split('#')[0];
  }

  /**
   * Walks the ACTIVATED route chain (root.firstChild), not `children[0]`: with flat
   * sibling routes, `children[0]` is the first declared child, so every page after the
   * first would have shown the wrong trail.
   */
  private buildBreadcrumbs(): Breadcrumb[] {
    const crumbs: Breadcrumb[] = [];
    const seen = new Set<string>();
    let route: ActivatedRoute | null = this.router.routerState.root;
    let url = '';

    while (route?.firstChild) {
      route = route.firstChild;
      const segment = route.snapshot.url.map((s) => s.path).join('/');
      if (segment) url += `/${segment}`;

      const key = route.snapshot.data['breadcrumb'] as NavKey | undefined;
      if (key && key !== 'dashboard' && !seen.has(url)) {
        seen.add(url);
        const lang = this.languageService.current();
        crumbs.push({ label: navI18n[lang][key] ?? key, url });
      }
    }

    // Section crumb, derived from the nav tree — no per-route data needed.
    const section = sectionKeyForRoute(this.router.url);
    if (section && crumbs.length > 0) {
      crumbs.unshift({ label: sectionLabel(section, this.languageService.current()) });
    }

    return crumbs;
  }

  updateLastLabel(label: string) {
    const current = this.breadcrumbs();
    if (current.length > 0) {
      this.lastLabelOverride.set({ url: this.currentPathUrl(), label });
      const updated = [...current];
      updated[updated.length - 1] = { ...updated[updated.length - 1], label };
      this.breadcrumbs.set(updated);
    }
  }
}