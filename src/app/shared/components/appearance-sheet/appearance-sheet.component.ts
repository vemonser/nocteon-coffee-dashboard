import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { ThemeService } from '../../../core/theme/theme.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSettings } from '@ng-icons/lucide';
import { ThemeToggleComponent } from "../../../core/theme/theme-toggle.component";

@Component({
  selector: 'app-appearance-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmSheetImports, HlmButtonImports, HlmSwitchImports, HlmSeparatorImports, NgIcon, ThemeToggleComponent],
  providers: [
    provideIcons({
      lucideSettings,
    }),
  ],
  templateUrl: './appearance-sheet.component.html',
})
export class AppearanceSheetComponent {
  readonly theme = inject(ThemeService);
  readonly language = inject(LanguageService);

  readonly accents = [
    {
      id: 'emerald' as const,
      title: 'Emerald',
      subtitle: 'Fresh & Elegant',
      color: '#1F8A5B',
    },
    {
      id: 'burgundy' as const,
      title: 'Burgundy',
      subtitle: 'Bold & Premium',
      color: '#9D2335',
    },
  ];

  readonly languages = [
    { id: 'en' as const, title: 'English' },
    { id: 'ar' as const, title: 'العربية' },
  ];

  readonly themeTransition = signal(true);

  setTheme(theme: 'light' | 'dark', event: MouseEvent): void {
    if (this.theme.theme() === theme) return;

    if (!this.themeTransition()) {
      this.theme.setTheme(theme);
      return;
    }

    document.documentElement.style.setProperty('--x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--y', `${event.clientY}px`);

    const apply = () => this.theme.setTheme(theme);

    if ('startViewTransition' in document) {
      (document as any).startViewTransition(apply);
    } else {
      apply();
    }
  }

  // ملحوظة: مبقاش محتاج MouseEvent هنا خالص — الكارت بقى بيعتمد
  // على CSS transitions بس، مفيش JS animation ليها إحداثيات
  setAccent(color: 'emerald' | 'burgundy'): void {
    if (this.theme.color() === color) return;
    this.theme.setColor(color);
  }

  setLanguage(lang: 'ar' | 'en'): void {
    this.language.setLanguage(lang);
  }
}