import { Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideBadgeCheck } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-verified-badge',
  standalone: true,
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideBadgeCheck })],
  template: `
    @if (verified()) {
      <span
        class="inline-flex items-center"
        [attr.title]="'reviews.columns.verifiedPurchase' | transloco"
        [attr.aria-label]="'reviews.columns.verifiedPurchase' | transloco"
      >
        <ng-icon name="lucideBadgeCheck" class="size-4 text-primary" aria-hidden="true" />
      </span>
    }
  `,
})
export class VerifiedBadgeComponent {
  readonly verified = input<boolean>(false);
}