import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldAlert } from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstAllowedRouteFor } from '../../core/auth/permission-routes';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [HlmButtonImports, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideShieldAlert })],
  template: `
    <div class="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
      <ng-icon name="lucideShieldAlert" class="size-16 text-destructive" />
      <h1 class="text-3xl font-bold tracking-tight">{{ 'unauthorized.title' | transloco }}</h1>
      @if (missingPermission()) {
        <p class="max-w-md text-sm text-muted-foreground">
          {{ 'unauthorized.missingPrefix' | transloco }} <span class="font-mono text-xs" data-testid="unauthorized-slug">{{ missingPermission() }}</span> {{ 'unauthorized.missingSuffix' | transloco }}
        </p>
      } @else {
        <p class="max-w-md text-muted-foreground">{{ 'unauthorized.message' | transloco }}</p>
      }
      <button hlmBtn (click)="goBack()">{{ 'unauthorized.goBack' | transloco }}</button>
    </div>
  `,
})
export class UnauthorizedComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private transloco = inject(TranslocoService);

  missingPermission(): string | null {
    const qp = this.route.snapshot.queryParamMap;
    const slug = qp.get('permission');
    if (slug) return slug;
    return null;
  }

  goBack(): void {
    const next = firstAllowedRouteFor(this.auth.currentUser()!);
    this.router.navigateByUrl(next);
  }
}