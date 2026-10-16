import { Injectable, signal, computed, effect } from '@angular/core';
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
      const updated = [...current];
      updated[updated.length - 1] = { ...updated[updated.length - 1], label };
      this.breadcrumbs.set(updated);
    }
  }
}