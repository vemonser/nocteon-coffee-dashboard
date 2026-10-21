import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowUpDown, lucideArrowUp, lucideArrowDown } from '@ng-icons/lucide';

@Component({
  selector: 'app-sort-header',
  standalone: true,
  imports: [NgIcon],
  providers: [provideIcons({ lucideArrowUpDown, lucideArrowUp, lucideArrowDown })],
  template: `
    <button
      type="button"
      class="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
      (click)="toggled.emit()"
      [attr.aria-sort]="active() ? direction() : 'none'"
    >
      <span>{{ label() }}</span>
      @if (active() && direction() === 'asc') {
        <ng-icon name="lucideArrowUp" class="size-3" aria-hidden="true" />
      } @else if (active() && direction() === 'desc') {
        <ng-icon name="lucideArrowDown" class="size-3" aria-hidden="true" />
      } @else {
        <ng-icon name="lucideArrowUpDown" class="size-3 opacity-60" aria-hidden="true" />
      }
    </button>
  `,
})
export class SortHeaderComponent {
  readonly label = input<string>('');
  readonly active = input<boolean>(false);
  readonly direction = input<'asc' | 'desc'>('asc');
  readonly toggled = output<void>();
}
