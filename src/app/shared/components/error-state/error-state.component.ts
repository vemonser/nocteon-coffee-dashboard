import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideAlertTriangle, lucideRefreshCw } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';

/**
 * THE page-level error state.
 *
 * It says three things, in this order: WHAT failed, what to do about it, and
 * the backend's own message when there is one — plus a RETRY that really
 * retries. The look is the dashboard's widget error, scaled to a page: the
 * same destructive-soft panel, the warning icon and the shared copy
 * (`common.errorTitle`), so a failure reads the same whether it happened in a
 * card or on a whole list.
 *
 * The copy inputs are i18n KEYS, resolved here: a page passes
 * `'orders.errorState.title'` and the component reads the language signal
 * through the pipe, so a runtime language switch re-renders the message too
 * (a translated string captured in the page's computed would not).
 *
 * `role="alert"` is on the panel, not on the message, so the failure is
 * announced once when it appears.
 */
@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, NgIcon, HlmButtonImports],
  providers: [provideIcons({ lucideAlertTriangle, lucideRefreshCw })],
  templateUrl: './error-state.component.html',
})
export class ErrorStateComponent {
  /** The i18n key of WHAT failed. */
  readonly titleKey = input<string>('common.errorTitle');
  /** The i18n key of what the reader can do about it. */
  readonly hintKey = input<string>('common.loadFailedHint');
  /** The backend's own message (already human text, not a key). */
  readonly message = input<string>('');
  /** The i18n key of the retry label. */
  readonly retryKey = input<string>('common.retry');

  readonly retry = output<void>();
}
