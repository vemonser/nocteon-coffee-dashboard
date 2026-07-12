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
}