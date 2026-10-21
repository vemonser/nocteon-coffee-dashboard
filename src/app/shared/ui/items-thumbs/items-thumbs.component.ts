import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ThumbItem { imageUrl?: string | null; name?: string | null; }

@Component({
  selector: 'app-items-thumbs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-1">
      @for (it of shown(); track $index) {
        <div class="h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
          @if (it.imageUrl) {
            <img [src]="it.imageUrl" [alt]="it.name ?? ''" class="h-full w-full object-cover" />
          }
        </div>
      }
      @if (extra() > 0) {
        <span class="text-xs text-muted-foreground">+{{ extra() }}</span>
      }
      <span class="ms-1 text-xs text-muted-foreground">{{ count() }} items</span>
    </div>
  `,
})
export class ItemsThumbsComponent {
  readonly items = input<ThumbItem[]>([]);
  readonly max = input(3);

  protected shown(): ThumbItem[] { return (this.items() ?? []).slice(0, this.max()); }
  protected extra(): number { return Math.max(0, (this.items()?.length ?? 0) - this.max()); }
  protected count(): number { return this.items()?.length ?? 0; }
}