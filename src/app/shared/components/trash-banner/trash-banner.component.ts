import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTriangleAlert } from '@ng-icons/lucide';

/**
 * §4 trash banner: warning-soft, one sentence, with an optional neutral
 * action (Restore). Reused by every trash-aware surface.
 */
@Component({
  selector: 'app-trash-banner',
  standalone: true,
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './trash-banner.component.html',
})
export class TrashBannerComponent {
  message = input.required<string>();
  actionLabel = input<string>('');
  action = output<void>();
}
