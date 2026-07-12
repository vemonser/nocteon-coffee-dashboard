import { Injectable, signal, computed, effect } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { Breadcrumb } from '../model/breadcrumb.model';
import { LanguageService } from '../../../../core/i18n/language.service';
import { navI18n, NavKey } from '../../../i18n/nav-i18n';
 
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private breadcrumbs = signal<Breadcrumb[]>([]);
  readonly items = computed(() => this.breadcrumbs());

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private languageService: LanguageService,
  ) {
    // ← لما الـ route يتغيّر
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.rebuild());

    // ← لما اللغة تتغيّر (من غير navigation)
    effect(() => {
      this.languageService.language(); // read signal
      this.rebuild();
    });
  }

  private rebuild(): void {
    const root = this.router.routerState.root;
    this.breadcrumbs.set(this.buildBreadcrumbs(root));
  }

  private buildBreadcrumbs(
    route: ActivatedRoute,
    url: string = '',
    breadcrumbs: Breadcrumb[] = [],
    seen = new Set<string>(),
  ): Breadcrumb[] {
    const children = route.children;
    if (children.length === 0) return breadcrumbs;

    const child = children[0];
    const routeURL = child.snapshot.url.map((s) => s.path).join('/');

    if (!routeURL && !child.snapshot.data['breadcrumb']) {
      return this.buildBreadcrumbs(child, url, breadcrumbs, seen);
    }

    if (routeURL) url += `/${routeURL}`;

    const key = child.snapshot.data['breadcrumb'] as NavKey | undefined;
    if (key && key !== 'dashboard' && !seen.has(url)) {
      seen.add(url);
      const lang = this.languageService.current();
      const label = navI18n[lang][key] ?? key;
      breadcrumbs.push({ label, url });
    }

    return this.buildBreadcrumbs(child, url, breadcrumbs, seen);
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