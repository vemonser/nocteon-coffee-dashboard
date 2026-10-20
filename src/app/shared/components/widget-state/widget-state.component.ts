import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideAlertTriangle, lucideRefreshCw } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';

/**
 * The three states every widget can be in.
 *
 * A widget is NEVER blank and never silently missing:
 *
 *  - **loading** — a skeleton with the shape of the content, so the page
 *    does not jump when the data lands;
 *  - **error** — what failed, and a RETRY that really retries;
 *  - **empty** — the widget is fine, there is simply nothing to show.
 *
 * The wrapper owns the decision so no widget has to remember it, and so the
 * three states look the same everywhere.
 */
@Component({
  selector: 'app-widget-state',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideAlertTriangle, lucideRefreshCw })],
  templateUrl: './widget-state.component.html',
  styleUrl: './widget-state.component.css',
})
export class WidgetStateComponent {
  /** Is the data still loading? */
  readonly loading = input<boolean>(false);
  /** The error message, when the widget failed. */
  readonly error = input<string | null>(null);
  /** Is there simply nothing to show? */
  readonly empty = input<boolean>(false);
  /** The label for the empty state. */
  readonly emptyLabel = input<string>('');
  /** The retry action. */
  readonly retry = input<() => void>(() => undefined);
  /** How many skeleton rows to draw. */
  readonly skeletonRows = input<number>(3);

  /** Which state to render. */
  readonly state = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
    if (this.loading()) return 'loading';
    if (this.error()) return 'error';
    if (this.empty()) return 'empty';
    return 'ready';
  });
}
