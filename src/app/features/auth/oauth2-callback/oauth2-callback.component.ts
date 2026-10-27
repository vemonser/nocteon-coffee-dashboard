import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../../../core/auth/auth.service';
import { canEnterDashboard } from '../../../core/auth/dashboard-roles';
import { firstAllowedRouteFor } from '../../../core/auth/permission-routes';

type CallbackState = 'processing' | 'error' | 'unauthorized';

/**
 * OAuth2 callback page. The backend redirects here with a short-lived,
 * single-use code; the access token never appears in the URL. The code is
 * exchanged for a session and immediately removed from the address bar/history.
 */
@Component({
  selector: 'app-oauth2-callback',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-svh items-center justify-center bg-background px-6">
      <div class="w-full max-w-sm text-center">
        @if (state() === 'processing') {
          <div
            class="mx-auto mb-6 size-10 animate-spin rounded-full border-2 border-muted border-t-primary"
            aria-hidden="true"
          ></div>
          <h1 class="font-heading text-2xl text-foreground">
            {{ 'oauth2Callback.processing' | transloco }}
          </h1>
        } @else {
          <h1 class="font-heading text-2xl text-foreground">
            @if (state() === 'unauthorized') {
              {{ 'unauthorized.title' | transloco }}
            } @else {
              {{ 'oauth2Callback.failed' | transloco }}
            }
          </h1>
          <p class="mt-3 text-sm leading-relaxed text-muted-foreground">{{ message() }}</p>
          <button
            type="button"
            class="mt-8 w-full cursor-pointer rounded-lg bg-primary px-4 py-3 font-heading text-sm uppercase tracking-widest text-primary-foreground transition-colors hover:bg-primary/85"
            (click)="goToLogin()"
          >
            {{ 'oauth2Callback.backToLogin' | transloco }}
          </button>
        }
      </div>
    </section>
  `,
})
export class OAuth2CallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly trx = inject(TranslocoService);

  readonly state = signal<CallbackState>('processing');
  readonly message = signal('');

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (!code) {
      this.finishMissingCode();
      return;
    }

    // Keep the one-time code out of history even while the exchange is running.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });

    this.auth.exchangeOAuth2Code(code).subscribe({
      next: (res) => {
        const user = res.data?.user;
        if (!canEnterDashboard(user)) {
          this.auth.clearSession();
          this.state.set('unauthorized');
          this.message.set(this.trx.translate('unauthorized.message'));
          return;
        }
        void this.router.navigateByUrl(firstAllowedRouteFor(user), { replaceUrl: true });
      },
      error: (err) => {
        // The refresh cookie may already have established the session before
        // this component ran; a stale code must not throw away a valid session.
        if (this.auth.isLoggedIn() && canEnterDashboard(this.auth.currentUser())) {
          void this.router.navigateByUrl(
            firstAllowedRouteFor(this.auth.currentUser()),
            { replaceUrl: true },
          );
          return;
        }
        this.auth.clearSession();
        this.state.set('error');
        this.message.set(err.error?.message ?? this.trx.translate('oauth2Callback.failed'));
      },
    });
  }

  goToLogin(): void {
    this.auth.clearSession();
    void this.router.navigate(['/login'], { replaceUrl: true });
  }

  private finishMissingCode(): void {
    if (this.auth.isLoggedIn() && canEnterDashboard(this.auth.currentUser())) {
      void this.router.navigateByUrl(firstAllowedRouteFor(this.auth.currentUser()), {
        replaceUrl: true,
      });
      return;
    }
    this.state.set('error');
    this.message.set(this.trx.translate('oauth2Callback.missingCode'));
  }
}
