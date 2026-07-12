import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideBell,
  lucideLogOut,
  lucideUser,
  lucideSettings,
  lucideSun,
  lucideMoon,
  lucideGlobe,
  lucideMenu,
  lucideLoader2,
} from '@ng-icons/lucide';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmBreadcrumbImports } from '@spartan-ng/helm/breadcrumb';
import { HlmInputGroupImports } from '@spartan-ng/helm/input-group';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { FormsModule } from '@angular/forms';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, catchError, of, tap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ThemeService } from '../../../core/theme/theme.service';

import { NotificationComponent } from '../../notification/components/notification.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { AppearanceSheetComponent } from '../../../shared/components/appearance-sheet/appearance-sheet.component';
import { UserMenuComponent } from '../../../shared/ui/user-menu/user-menu.component';
import { GlobalSearchService } from './global-search/service/global-search.service';
import { SearchResultDto } from './global-search/model/search.model';

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
    AppearanceSheetComponent,
    UserMenuComponent,
  ],
  providers: [
    provideIcons({
      lucideSearch,
      lucideBell,
      lucideLogOut,
      lucideUser,
      lucideSettings,
      lucideSun,
      lucideMoon,
      lucideGlobe,
      lucideMenu,
      lucideLoader2,
    }),
  ],
  templateUrl: './navigation-bar.component.html',
})
export class NavigationBarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly globalSearch = inject(GlobalSearchService);

  readonly isDark = computed(() => this.theme.theme() === 'dark');

  // ─── Search State ───────────────────────────────────────────────────────────
  readonly searchQuery = signal('');
  readonly searchResults = signal<SearchResultDto[]>([]);
  readonly isSearching = signal(false);

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
    toObservable(this.searchQuery)
      .pipe(
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
            .pipe(catchError(() => of({ results: [], totalCount: 0 })));
        }),
        tap(() => this.isSearching.set(false)),
      )
      .subscribe((res) => {
        if (res) this.searchResults.set(res.results);
      });
  }

  onResultSelect(result: SearchResultDto | null | undefined): void {
    if (!result) return;

    this.searchQuery.set('');
    this.searchResults.set([]);

    // result.type is now the backend-provided route segment
    // (e.g. "products", "orders", "promo-codes") thanks to
    // @JsonValue on SearchResultType, so no local mapping is needed.
    this.router.navigate([`/dashboard/${result.type}/${result.identifier}`]);
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
