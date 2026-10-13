import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideShieldAlert } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [HlmButtonImports, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideShieldAlert })],
  template: `
    <div class="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
      <ng-icon name="lucideShieldAlert" class="size-16 text-destructive" />
      <h1 class="text-3xl font-bold tracking-tight">{{ 'unauthorized.title' | transloco }}</h1>
      <p class="max-w-md text-muted-foreground">{{ 'unauthorized.message' | transloco }}</p>
      <button hlmBtn (click)="goBack()">{{ 'unauthorized.goBack' | transloco }}</button>
    </div>
  `,
})
export class UnauthorizedComponent {
  private router = inject(Router);

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}