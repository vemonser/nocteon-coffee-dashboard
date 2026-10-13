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
import { LanguageService } from '../../../core/i18n/language.service';
import type { Language } from '../../../core/i18n/language';
import { TranslocoPipe } from '@jsverse/transloco';

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

  onSubmit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.success.set(false);

    this.auth.login(this.form.value.identifier!, this.form.value.password!).subscribe({
      next: () => {
        this.success.set(true);
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Login failed');
        this.loading.set(false);
      },
    });
  }
}