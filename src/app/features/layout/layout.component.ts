import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSettings } from '@ng-icons/lucide';
import { ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ThemeService } from '../../core/theme/theme.service';

import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { AppSidebarComponent } from './sidebar/app-sidebar.component';
import { NavigationBarComponent } from './navigation-bar/navigation-bar.component';

@Component({
  selector: 'app-layout.component',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,

    HlmSidebarImports,
    AppSidebarComponent,
    NavigationBarComponent,
  ],
  templateUrl: './layout.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block [--header-height:--spacing(14)]',
  },
  styleUrl: './layout.component.css',
  providers: [
    provideIcons({
      lucideSettings,
    }),
  ],
})
export class LayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);

  readonly isDark = computed(() => this.theme.theme() === 'dark');

  toggleTheme() {
    this.theme.toggleTheme();
  }

  toggleLanguage() {
    this.language.toggle();
  }

  getInitial(): string {
    const name = this.auth.getFullName();
    return name ? name.charAt(0).toUpperCase() : 'A';
  }

  onLogout() {
    this.auth.logout().subscribe();
  }
}