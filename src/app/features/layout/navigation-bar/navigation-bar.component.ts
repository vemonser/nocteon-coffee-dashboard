import { Component, computed, inject, signal, DestroyRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideMenu,
  lucideLoader2,
} from '@ng-icons/lucide';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmBreadcrumbImports } from '@spartan-ng/helm/breadcrumb';
import { HlmInputGroupImports } from '@spartan-ng/helm/input-group';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, catchError, of, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/auth/auth.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslocoService } from '@jsverse/transloco';
import { ThemeToggleComponent } from '../../../core/theme/theme-toggle.component';

import { NotificationComponent } from '../../notification/components/notification.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { UserMenuComponent } from '../../../shared/ui/user-menu/user-menu.component';
import { GlobalSearchService } from './global-search/service/global-search.service';
import { SearchResultItem as SearchResultDto } from './global-search/model/search.model';

@Component({
  selector: 'app-navigation-bar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    HlmSidebarImports,
    HlmSeparatorImports,
    HlmBreadcrumbImports,
    HlmInputGroupImports,
    HlmAutocompleteImports,
    NgIcon,
    BreadcrumbComponent,
    NotificationComponent,
    ThemeToggleComponent,
    UserMenuComponent,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideMenu,
      lucideLoader2,
    }),
  ],
  templateUrl: './navigation-bar.component.html',
})
export class NavigationBarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  /**
   * The sidebar trigger's label.
   *
   * It is a computed, not a transloco pipe, because the pipe in this
   * position kept the language the page BOOTED in: the label still said
   * "Toggle Sidebar" after a runtime switch to Arabic. The language signal
   * is read first, so the computed re-runs when the language changes.
   */
  protected readonly toggleSidebarLabel = computed(() => {
    this.language.language();
    return this.transloco.translate('common.toggleSidebar');
  });
  private readonly router = inject(Router);
  private readonly globalSearch = inject(GlobalSearchService);

  // ─── Search State ───────────────────────────────────────────────────────────
  readonly searchQuery = signal('');
  readonly searchResults = signal<SearchResultDto[]>([]);
  readonly isSearching = signal(false);
  private readonly notify = inject(NotifyService);

  readonly groupedResults = computed(() => {
    const results = this.searchResults();
    const groups = new Map<string, SearchResultDto[]>();

    for (const r of results) {
      if (!groups.has(r.type)) groups.set(r.type, []);
      groups.get(r.type)!.push(r);
    }

    return Array.from(groups.entries()).map(([type, items]) => ({
      type,
      label: this.formatTypeLabel(type),
      items,
    }));
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    toObservable(this.searchQuery)
      .pipe(
        takeUntilDestroyed(destroyRef),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 2) {
            this.searchResults.set([]);
            return of(null);
          }
          this.isSearching.set(true);
          return this.globalSearch
            .search(q)
            .pipe(
              catchError((err) => {
                // A failed search must NOT read as "no results": keep the
                // previous results and tell the user via toast.
                this.notify.apiError(err, 'notify.errorFallback', 'Search failed. Please try again.');
                return of(null);
              }),
            );
        }),
        tap(() => this.isSearching.set(false)),
      )
      .subscribe((res) => {
        // null = the request failed (toast already shown); keep prior results.
        if (res) this.searchResults.set(res.groups.flatMap((g) => g.items));
      });
  }

  onResultSelect(result: SearchResultDto | null | undefined): void {
    if (!result) return;

    this.searchQuery.set('');
    this.searchResults.set([]);

    // result.type is now the backend-provided route segment
    // (e.g. "products", "orders", "promo-codes") thanks to
    // @JsonValue on SearchResultType, so no local mapping is needed.
    this.router.navigate([`/dashboard/${result.type}/${encodeURIComponent(result.id)}`]);
  }
  private formatTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      orders: 'Orders',
      users: 'Users',
      products: 'Products',
      'promo-codes': 'Promo Codes',
      'journal-posts': 'Journal Posts',
    };
    return labels[type] || type;
  }
}
