import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../../core/i18n/language.service';
import { DashboardStatsService } from '../../../features/dashboard/services/dashboard-stats.service';
import { PluralPipe } from '../../pipes/plural.pipe';

/**
 * The header every dashboard widget uses.
 *
 * One pattern, so a reader learns it once:
 *
 *   [Title]  (Last 30 days)  [Action]
 *   ^^^^^^^  ^^^^^^^^^^^^^^  ^^^^^^^^
 *   sentence case, muted     optional link
 *
 * The range scope is ALWAYS present and always in the same format:
 * "Last 30 days" for a widget that reads the selected range, "All time" for
 * one that does not (a catalogue state such as low stock is not a period
 * metric). Before this, three different labels were in use — the range
 * name, "Selected period" and "All time" — so a reader could not tell which
 * widgets respected the range selector.
 *
 * The scope never wraps to a second line: the title truncates, the scope
 * label is `shrink-0`, and the whole header is a single flex row.
 */
@Component({
  selector: 'app-widget-header',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoPipe, PluralPipe, NgIcon],
  providers: [provideIcons({ lucideInfo })],
  template: `
    <div class="flex items-center justify-between gap-3 min-w-0">
      <div class="flex items-baseline gap-2 min-w-0">
        <h3 class="text-sm font-medium truncate" [title]="title()">{{ title() }}</h3>
        @if (infoTitle(); as info) {
          <span
            class="shrink-0 cursor-help"
            [title]="info"
            [attr.aria-label]="info"
          >
            <ng-icon name="lucideInfo" class="size-3.5 text-muted-foreground" />
          </span>
        }
        <span
          class="shrink-0 text-xs text-muted-foreground whitespace-nowrap"
          [title]="scopeLabel()"
        >
          @if (rangeScoped()) {
            {{ 'dashboard.last' | transloco }} {{ days() | plural: 'dashboard.countDays' }}
          } @else {
            {{ 'dashboard.allTime' | transloco }}
          }
        </span>
      </div>
      @if (actionLabel(); as label) {
        <a
          class="shrink-0 text-xs text-primary hover:underline whitespace-nowrap"
          [routerLink]="actionLink()"
        >
          {{ label }}
        </a>
      }
    </div>
  `,
})
export class WidgetHeaderComponent {
  /** The widget title — sentence case. */
  readonly title = input.required<string>();
  /**
   * Whether this widget respects the selected range. False renders "All time".
   */
  readonly rangeScoped = input<boolean>(true);
  /** Optional action link label. */
  readonly actionLabel = input<string | null>(null);
  /** Optional action link target. */
  readonly actionLink = input<string>('/dashboard');
  /** Optional explanatory note, shown as an info affordance next to the title. */
  readonly infoTitle = input<string | null>(null);

  private readonly stats = inject(DashboardStatsService);

  readonly days = computed(() => this.stats.days());

  /** The scope as one string, for the tooltip. */
  readonly scopeLabel = computed(() =>
    this.rangeScoped()
      ? `Last ${this.days()}`
      : 'All time',
  );
}
