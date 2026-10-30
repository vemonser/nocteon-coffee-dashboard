import { Injectable, signal, computed, effect, untracked } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { Breadcrumb } from '../model/breadcrumb.model';
import { LanguageService } from '../../../../core/i18n/language.service';
import { navI18n } from '../../../i18n/nav-i18n';
import type { BreadcrumbNavKey } from '../../../i18n/nav-i18n';
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
    this.applyCrumbLinkOverride();
    this.applyLastLabelOverride();
    this.applyAppendedCrumb();
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

      const key = route.snapshot.data['breadcrumb'] as BreadcrumbNavKey | undefined;
      if (key && key !== 'dashboard' && !seen.has(url)) {
        const label = navI18n[this.languageService.current()][key];
        // A route data key without a translation used to fall back to the raw
        // key ("newProduct" on screen). The label is the only thing a crumb may
        // show, so an untranslated route contributes NO crumb — and
        // `scripts/breadcrumb-check.mjs` fails the build before it can ship.
        if (!label) continue;
        seen.add(url);
        crumbs.push({ label, url });
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

  /**
   * Point one crumb at a different URL, without changing the trail's shape.
   *
   * <p>A detail page reached from a filtered list needs its parent crumb to
   * return to THAT list (the filters live in the URL), not to the bare
   * list. The override is scoped to the path it was set on and remembered
   * across a language switch, exactly like the last-label override.
   */
  updateCrumbLink(crumbUrl: string, url: string) {
    this.crumbLinkOverride.set({
      path: this.currentPathUrl(),
      crumbUrl,
      url,
    });
    this.applyCrumbLinkOverride();
  }

  private crumbLinkOverride = signal<{ path: string; crumbUrl: string; url: string } | null>(null);

  private applyCrumbLinkOverride(): void {
    untracked(() => {
      const override = this.crumbLinkOverride();
      if (!override) return;
      if (override.path !== this.currentPathUrl()) {
        this.crumbLinkOverride.set(null);
        return;
      }
      const current = this.breadcrumbs();
      // A detail route's crumb carries the DETAIL url (`/orders/1`), not the
      // list url (`/orders`), so the match accepts the list url as a prefix.
      // The detail page is the only caller of this method today; the prefix
      // rule is what makes "Orders" point back at the list it came from.
      const index = current.findIndex(
        (crumb) =>
          crumb.url === override.crumbUrl || crumb.url?.startsWith(`${override.crumbUrl}/`),
      );
      if (index < 0) return;
      const updated = [...current];
      updated[index] = { ...updated[index], url: override.url };
      this.breadcrumbs.set(updated);
    });
  }

  /**
   * Add the current page as a crumb AFTER the route's own trail.
   *
   * <p>A generic detail route carries the list's crumb ("Orders"); the page
   * itself has no route data of its own. Replacing that crumb with the entity
   * name (the `updateLastLabel` idiom) would lose the way back to the list, so
   * the entity is APPENDED instead: `Operations > Orders > ORD-2026-000001`.
   * The appended crumb is scoped to the URL it was set on and re-applied after
   * a rebuild (navigation, language switch), like every other override.
   */
  appendCrumb(label: string) {
    this.appendedCrumb.set({ url: this.currentPathUrl(), label });
    this.applyAppendedCrumb();
  }

  private appendedCrumb = signal<{ url: string; label: string } | null>(null);

  private applyAppendedCrumb(): void {
    untracked(() => {
      const override = this.appendedCrumb();
      if (!override) return;
      if (override.url !== this.currentPathUrl()) {
        this.appendedCrumb.set(null);
        return;
      }
      const current = this.breadcrumbs();
      if (current.length === 0) return;
      const last = current[current.length - 1];
      if (last.label === override.label) return;
      this.breadcrumbs.set([...current, { label: override.label, url: override.url }]);
    });
  }
}