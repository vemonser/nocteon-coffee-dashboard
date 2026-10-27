import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';

import { AuthService } from '../../../core/auth/auth.service';
import { NotifyService } from '../../../core/notify/notify.service';

type Step = 'request' | 'reset';

/**
 * Two-step password recovery against /api/auth/forgot-password and
 * /api/auth/reset-password. The request step is deliberately generic: the
 * backend never reveals whether an email exists.
 */
@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, HlmButtonImports, HlmInputImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <div class="w-full max-w-md">
        <a
          routerLink="/login"
          class="mb-8 inline-block font-heading text-2xl tracking-wide text-foreground"
        >
          NOCTEON
        </a>

        @if (step() === 'request') {
          <h1 class="font-heading text-3xl text-foreground">
            {{ 'forgotPassword.title' | transloco }}
          </h1>
          <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
            {{ 'forgotPassword.subtitle' | transloco }}
          </p>

          <form class="mt-8 space-y-5" [formGroup]="emailForm" (ngSubmit)="requestCode()">
            <div class="space-y-2">
              <label for="email" class="text-sm font-medium text-foreground">
                {{ 'forgotPassword.email' | transloco }}
              </label>
              <input
                hlmInput
                id="email"
                type="email"
                class="w-full"
                formControlName="email"
                autocomplete="email"
              />
            </div>

            @if (message()) {
              <p class="text-sm text-muted-foreground">{{ message() }}</p>
            }

            <button
              hlmBtn
              type="submit"
              size="lg"
              class="w-full cursor-pointer font-heading uppercase tracking-widest"
              [disabled]="emailForm.invalid || loading()"
            >
              {{ (loading() ? 'forgotPassword.sending' : 'forgotPassword.sendCode') | transloco }}
            </button>
          </form>
        } @else {
          <h1 class="font-heading text-3xl text-foreground">
            {{ 'forgotPassword.resetTitle' | transloco }}
          </h1>
          <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
            {{ message() || ('forgotPassword.codeSent' | transloco) }}
          </p>

          <form class="mt-8 space-y-5" [formGroup]="resetForm" (ngSubmit)="reset()">
            <div class="space-y-2">
              <label for="reset-email" class="text-sm font-medium text-foreground">
                {{ 'forgotPassword.email' | transloco }}
              </label>
              <input
                hlmInput
                id="reset-email"
                type="email"
                class="w-full"
                formControlName="email"
                autocomplete="email"
              />
            </div>
            <div class="space-y-2">
              <label for="otp" class="text-sm font-medium text-foreground">
                {{ 'forgotPassword.otp' | transloco }}
              </label>
              <input
                hlmInput
                id="otp"
                inputmode="numeric"
                maxlength="6"
                class="w-full tracking-[0.4em]"
                formControlName="otp"
                autocomplete="one-time-code"
              />
            </div>
            <div class="space-y-2">
              <label for="new-password" class="text-sm font-medium text-foreground">
                {{ 'forgotPassword.newPassword' | transloco }}
              </label>
              <input
                hlmInput
                id="new-password"
                type="password"
                class="w-full"
                formControlName="newPassword"
                autocomplete="new-password"
              />
            </div>
            <div class="space-y-2">
              <label for="confirm-password" class="text-sm font-medium text-foreground">
                {{ 'forgotPassword.confirmPassword' | transloco }}
              </label>
              <input
                hlmInput
                id="confirm-password"
                type="password"
                class="w-full"
                formControlName="confirmPassword"
                autocomplete="new-password"
              />
            </div>

            <button
              hlmBtn
              type="submit"
              size="lg"
              class="w-full cursor-pointer font-heading uppercase tracking-widest"
              [disabled]="resetForm.invalid || loading()"
            >
              {{ (loading() ? 'forgotPassword.resetting' : 'forgotPassword.reset') | transloco }}
            </button>
          </form>
        }

        <p class="mt-8 text-center text-sm text-muted-foreground">
          <a routerLink="/login" class="underline underline-offset-4 hover:text-primary">
            {{ 'forgotPassword.backToLogin' | transloco }}
          </a>
        </p>
      </div>
    </section>
  `,
})
export class PasswordResetComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly trx = inject(TranslocoService);
  private readonly notify = inject(NotifyService);

  readonly step = signal<Step>('request');
  readonly loading = signal(false);
  readonly message = signal('');

  readonly emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly resetForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  constructor() {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.emailForm.patchValue({ email });
      this.resetForm.patchValue({ email });
      this.step.set('reset');
    }
  }

  requestCode(): void {
    if (this.emailForm.invalid || this.loading()) return;
    this.loading.set(true);
    this.message.set('');
    const email = this.emailForm.value.email!;

    this.auth.forgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.resetForm.patchValue({ email });
        this.message.set(this.trx.translate('forgotPassword.codeSent'));
        this.step.set('reset');
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not send the reset code');
      },
    });
  }

  reset(): void {
    if (this.resetForm.invalid || this.loading()) return;
    const value = this.resetForm.value;
    if (value.newPassword !== value.confirmPassword) {
      this.notify.warning('forgotPassword.mismatch', 'Passwords do not match');
      return;
    }

    this.loading.set(true);
    this.auth
      .resetPassword({
        email: value.email!,
        otp: value.otp!,
        newPassword: value.newPassword!,
        confirmPassword: value.confirmPassword!,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.notify.success('forgotPassword.success', 'Password reset. Please sign in.');
          void this.router.navigate(['/login'], { replaceUrl: true });
        },
        error: (err) => {
          this.loading.set(false);
          this.notify.apiError(err, 'notify.errorFallback', 'Could not reset the password');
        },
      });
  }
}
