import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matfGoogleColored } from '@ng-icons/material-file-icons/colored';
import {
  lucideLoader2,
  lucideCircleCheck,
  lucideEye,
  lucideEyeOff,
  lucideArrowRight,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';

import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { DASHBOARD_ENTRY_PERMISSION } from '../../../core/auth/permission-routes';
import { LanguageService } from '../../../core/i18n/language.service';
import type { Language } from '../../../core/i18n/language';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    RouterLink,
    HlmFieldImports,
    HlmInputImports,
    HlmButtonImports,
    NgIcon,
    CommonModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      matfGoogleColored,
      lucideLoader2,
      lucideCircleCheck,
      lucideEye,
      lucideEyeOff,
      lucideArrowRight,
    }),
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  public language = inject(LanguageService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private trx = inject(TranslocoService);

  loading = signal(false);
  error = signal('');
  success = signal(false);
  showPassword = signal(false);

  form = this.fb.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required],
  });

  setLanguage(lang: Language): void {
    this.language.setLanguage(lang);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  loginWithGoogle(): void {
    this.auth.startGoogleLogin();
  }

  onSubmit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.success.set(false);

    this.auth.login(this.form.value.identifier!, this.form.value.password!).subscribe({
      next: (res) => {
        this.loading.set(false);

        // The backend authenticates any valid account (200 for a CUSTOMER
        // too), so the status alone can't gate the dashboard — the role can.
        // Storefront accounts are shown the access-denied copy and dropped
        // back out (no session); authGuard covers deep links/reloads.
        if (!this.auth.hasPermission(DASHBOARD_ENTRY_PERMISSION)) {
          this.error.set(this.trx.translate('unauthorized.message'));
          this.auth.clearSession();
          return;
        }

        this.success.set(true);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Login failed');
        this.loading.set(false);
      },
    });
  }
}