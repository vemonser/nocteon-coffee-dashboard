import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
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
  private readonly router = inject(Router);

  /** The page area — the heading lives inside it. */
  private readonly main = viewChild<ElementRef<HTMLElement>>('main');

  constructor() {
    /**
     * The focus moves to the page heading after every navigation.
     *
     * A nav item keeps DOM focus after an SPA navigation, so its
     * `focus-visible:ring-2` stayed painted on the item the admin had just
     * left. Moving the focus to the heading fixes the ring and gives a
     * screen-reader user the place they expect to land.
     */
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => setTimeout(() => this.focusPageHeading()));
  }

  private focusPageHeading(): void {
    const heading = this.main()?.nativeElement?.querySelector('h1');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }

  getInitial(): string {
    const name = this.auth.getFullName();
    return name ? name.charAt(0).toUpperCase() : 'A';
  }

  onLogout() {
    // AuthService.logout clears the local session and returns to /login in a
    // finalize(), so a failed POST still leaves this device signed out. The
    // toast matters: the server session could not be revoked.
    this.auth.logout().subscribe({
      error: (err) => this.notify.apiError(err, 'notify.logoutFailed', 'Logout failed'),
    });
  }
}
