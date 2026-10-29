import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon } from '@ng-icons/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';

/**
 * THE empty state.
 *
 * A list with nothing in it is a designed surface, not a blank region:
 *
 *  - an icon in a muted disc, so the region reads as "a state" and not as a
 *    table that failed to render;
 *  - a TITLE that says what is missing ("No orders match these filters");
 *  - a HINT that says what to do about it;
 *  - the ACTION that resolves it — "Clear filters", "Add product" — because
 *    an empty state without a way out is a dead end (FE-27).
 *
 * `compact` is the in-table variant: the state lives inside a `<td>`, so the
 * vertical rhythm is tighter and the icon is smaller.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, NgIcon, HlmButtonImports],
  templateUrl: './empty-state.component.html',
})
export class EmptyStateComponent {
  /** The icon. Any globally provided `ng-icon` name (`lucideInbox` by default). */
  readonly icon = input<string>('lucideInbox');
  /** What is missing, in the reader's language. */
  readonly title = input.required<string>();
  /** What to do about it. Optional: some states have nothing to add. */
  readonly hint = input<string>('');
  /** The label of the resolving action; no label, no button. */
  readonly actionLabel = input<string>('');
  /** Tighter spacing for a state that lives inside a table cell. */
  readonly compact = input<boolean>(false);

  /** The reader took the resolving action. */
  readonly action = output<void>();
}
