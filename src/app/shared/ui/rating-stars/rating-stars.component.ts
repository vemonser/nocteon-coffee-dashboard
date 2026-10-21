import { Component, input } from '@angular/core';

@Component({
  selector: 'app-rating-stars',
  standalone: true,
  template: `
    <span class="inline-flex items-center gap-2" [attr.aria-label]="rating() + ' out of ' + max()">
      @for (star of stars(); track star) {
        @if (star < rating()) {
          <svg viewBox="0 0 24 24" class="size-4 text-warning" aria-hidden="true">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" class="size-4 text-muted-foreground/40" aria-hidden="true">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
          </svg>
        }
      }
      @if (showText()) {
        <span class="ms-2 min-w-[2.5rem] text-xs tabular-nums text-muted-foreground">
          {{ rating() }}/{{ max() }}
        </span>
      }
    </span>
  `,
})
export class RatingStarsComponent {
  readonly rating = input<number>(0);
  readonly max = input<number>(5);
  readonly showText = input<boolean>(false);
  protected stars(): number[] {
    return Array.from({ length: this.max() }, (_, i) => i);
  }
}