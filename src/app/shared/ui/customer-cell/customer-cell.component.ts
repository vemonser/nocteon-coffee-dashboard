import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-customer-cell',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  template: `
    <div class="flex items-center gap-2 min-w-[180px]">
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
        {{ initial() }}
      </div>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium" [title]="name()">{{ name() }}</p>
        <p class="truncate text-xs text-muted-foreground" [title]="email()">{{ email() }}</p>
      </div>
    </div>
  `,
})
export class CustomerCellComponent {
  readonly name = input<string | null>(null);
  readonly email = input<string | null>(null);
  readonly avatar = input<string | null>(null);

  protected initial(): string {
    const n = (this.name() ?? this.email() ?? '?').trim();
    return n.length ? n.charAt(0).toUpperCase() : '?';
  }
}