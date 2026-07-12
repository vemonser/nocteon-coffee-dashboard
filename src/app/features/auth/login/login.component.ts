import { ChangeDetectionStrategy, Component, inject ,signal} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink ,Router} from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matfGoogleColored} from '@ng-icons/material-file-icons/colored';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';


import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageService } from '../../../core/i18n/language.service';


@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ RouterLink, HlmFieldImports, HlmInputImports, HlmButtonImports, NgIcon,CommonModule, ReactiveFormsModule],
  providers: [provideIcons({ matfGoogleColored })],
    templateUrl: "./login.component.html",
    styleUrl: './login.component.css'

})
export class LoginComponent {
    constructor(public language: LanguageService) {}
    private fb = inject(FormBuilder);
    private auth = inject(AuthService);
    private router = inject(Router);

    loading = signal(false);
    error = signal('');

    form = this.fb.group({
        identifier: ['', Validators.required],
        password: ['', Validators.required]
    });

    onSubmit() {
        if (this.form.invalid) return;
        this.loading.set(true);
        this.error.set('');

        this.auth.login(
            this.form.value.identifier!,
            this.form.value.password!
        ).subscribe({
            next: () => this.router.navigate(['/dashboard']),
            error: (err) => {
                this.error.set(err.error?.message ?? 'Login failed');
                this.loading.set(false);
            }
        });
    }
}