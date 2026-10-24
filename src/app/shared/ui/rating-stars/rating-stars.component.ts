import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-rating-stars',
  standalone: true,
  template: `
    <span class="inline-flex items-center gap-2" [attr.aria-label]="rating() + ' out of ' + max()">
      @for (i of [1,2,3,4,5]; track i) {
        <span
          class="star-item"
          [style.--fill-percent]="fillPercent(i) + '%'"
        >
          ★
        </span>
      }
    </span>
    @if (showText()) {
      <span class="ms-2 min-w-[2.5rem] text-xs tabular-nums text-muted-foreground">
        {{ rating() }}/{{ max() }}
      </span>
    }
  `,
  styles: [
    `
      .star-item {
        width: 1.2em;
        height: 1.2em;
        color: var(--star-color, #ecc94b);
        /* Conic-gradient fills the star proportionally based on --fill-percent */
        background: conic-gradient(
          from 120deg at 50% 50%,
          var(--star-color) var(--fill-percent),
          transparent calc(var(--fill-percent) + 1%)
        );
        /* Mask to create the star shape from the ★ character */
        -webkit-mask: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='currentColor' stroke-width='2' d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'%3E%3C/svg%3E") center/1em no-repeat;
        -webkit-mask-composite: source-in;
        mask-composite: intersect;
        display: inline-block;
        font-size: 20px;
      }
    `,
  ],
})
export class RatingStarsComponent {
  readonly rating = input<number>(0);
  readonly max = input<number>(5);
  readonly showText = input<boolean>(false);

  /** Fill percentage for star at position i (1=leftmost, 5=rightmost) */
  protected fillPercent(i: number): number {
    const ratingAboveFloor = this.rating() >= i;
    if (!ratingAboveFloor) return 0;

    const aboveFloor = this.rating() - i + 1;
    if (aboveFloor > 1) return 100;
    if (aboveFloor <= 0) return 0;
    // Decimal part determines fill: e.g., 4.3 → star 5 gets 30%, 4.7 → star 5 gets 70%
    return Math.round(((aboveFloor % 1) + 1) * 100);
  }
}