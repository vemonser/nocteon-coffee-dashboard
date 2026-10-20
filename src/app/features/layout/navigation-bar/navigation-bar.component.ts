import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideMenu, lucideCommand } from '@ng-icons/lucide';
import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmBreadcrumbImports } from '@spartan-ng/helm/breadcrumb';
import { HlmInputGroupImports } from '@spartan-ng/helm/input-group';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslocoService } from '@jsverse/transloco';
import { ThemeToggleComponent } from '../../../core/theme/theme-toggle.component';
import { NotificationComponent } from '../../notification/components/notification.component';
import { BreadcrumbComponent } from '../../../shared/components/breadcrumb/breadcrumb.component';
import { UserMenuComponent } from '../../../shared/ui/user-menu/user-menu.component';
import { GlobalSearchPaletteComponent } from './global-search/global-search-palette.component';

@Component({
  selector: 'app-navigation-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HlmSidebarImports, HlmSeparatorImports, HlmBreadcrumbImports, HlmInputGroupImports, HlmButtonImports, NgIcon, BreadcrumbComponent, NotificationComponent, ThemeToggleComponent, UserMenuComponent, TranslocoPipe, GlobalSearchPaletteComponent],
  providers: [provideIcons({ lucideSearch, lucideMenu, lucideCommand })],
  templateUrl: './navigation-bar.component.html',
})
export class NavigationBarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  protected readonly toggleSidebarLabel = computed(() => { this.language.language(); return this.transloco.translate('common.toggleSidebar'); });
  private readonly router = inject(Router);
  readonly paletteOpen = signal(false);
  openPalette(): void { this.paletteOpen.set(true); }
  closePalette(): void { this.paletteOpen.set(false); }
}
