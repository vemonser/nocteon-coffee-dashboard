import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUser, lucideCamera, lucideKey, lucideSave } from '@ng-icons/lucide';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmAvatarImports } from '@spartan-ng/helm/avatar';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { TranslocoPipe } from '@jsverse/transloco';

import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgIcon,
    HlmCardImports,
    HlmAvatarImports,
    HlmButtonImports,
    HlmInputImports,
    HlmLabelImports,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideUser,
      lucideCamera,
      lucideKey,
      lucideSave,
    }),
  ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly saving = signal(false);
  protected readonly successMessage = signal('');

  protected readonly profileForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly passwordForm: FormGroup = this.fb.group({
    currentPassword: ['', [Validators.required, Validators.minLength(8)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  constructor() {
    const user = this.auth.currentUser();
    if (user) {
      this.profileForm.patchValue({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
      });
    }
  }

  protected onSaveProfile(): void {
    if (this.profileForm.invalid) {
      return;
    }

    this.saving.set(true);
    this.successMessage.set('');

    const { firstName, lastName, email } = this.profileForm.value;

    this.auth.updateProfile({ firstName, lastName, email }).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Profile updated successfully');
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected onChangePassword(): void {
    if (this.passwordForm.invalid) {
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;

    if (newPassword !== confirmPassword) {
      return;
    }

    this.saving.set(true);
    this.successMessage.set('');

    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Password changed successfully');
        this.passwordForm.reset();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected onAvatarUpload(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      this.saving.set(true);
      this.auth.updateAvatar(file).subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set('Avatar updated successfully');
        },
        error: () => {
          this.saving.set(false);
        },
      });
    };
    input.click();
  }
}
