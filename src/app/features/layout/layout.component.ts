import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSettings } from '@ng-icons/lucide';
import { ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { NotifyService } from '../../core/notify/notify.service';

import { HlmSidebarImports } from '@spartan-ng/helm/sidebar';
import { HlmToaster } from '@spartan-ng/helm/sonner';
import { AppSidebarComponent } from './sidebar/app-sidebar.component';
import { NavigationBarComponent } from './navigation-bar/navigation-bar.component';

import { TranslocoPipe } from '@jsverse/transloco';
@Component({
  selector: 'app-layout.component',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,

    HlmSidebarImports,
    HlmToaster,
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
  private readonly notify = inject(NotifyService);

  getInitial(): string {
    const name = this.auth.getFullName();
    return name ? name.charAt(0).toUpperCase() : 'A';
  }

  onLogout() {
    // Fire the POST; on failure the session stays alive — say so instead of
    // navigating the user into the logged-out state as if it worked.
    this.auth.logout().subscribe({
      error: (err) => this.notify.apiError(err, 'notify.logoutFailed', 'Logout failed'),
    });
  }
}