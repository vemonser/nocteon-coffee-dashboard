import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHome, lucideChevronRight, lucideChevronLeft } from '@ng-icons/lucide';
import { HlmBreadcrumbImports } from '@spartan-ng/helm/breadcrumb';

import { LanguageService } from '../../../core/i18n/language.service';
import { BreadcrumbService } from './service/breadcrumb.service';

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule, HlmBreadcrumbImports, NgIcon],
  providers: [provideIcons({ lucideHome, lucideChevronRight, lucideChevronLeft })],
  templateUrl: './breadcrumb.component.html',
})
export class BreadcrumbComponent {
  private breadcrumbService = inject(BreadcrumbService);
  protected languageService = inject(LanguageService);

  breadcrumbs = computed(() => this.breadcrumbService.items());

  /**
   * The path part of a crumb URL.
   *
   * <p>`RouterLink` treats a STRING as a single command, so a crumb such as
   * `/dashboard/orders?status=DELIVERED` would be serialised as
   * `/dashboard/orders%3Fstatus%3DDELIVERED` — a different route. The query
   * is therefore split out and handed to `queryParams`, which is the only
   * form `RouterLink` understands.
   */
  protected crumbPath(url: string | undefined): string {
    return (url ?? '').split('?')[0];
  }

  /** The query part of a crumb URL, as RouterLink's `queryParams`. */
  protected crumbQueryParams(url: string | undefined): Record<string, string> {
    const query = (url ?? '').split('?')[1];
    if (!query) return {};
    const params: Record<string, string> = {};
    new URLSearchParams(query).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }
}