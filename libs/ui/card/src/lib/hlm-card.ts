import { Directive, input } from '@angular/core';
import { classes } from '@spartan-ng/helm/utils';
import { HlmCardConfig, injectHlmCardConfig } from './hlm-card.token';

@Directive({
  selector: '[hlmCard],hlm-card',
  host: {
    'data-slot': 'card',
    '[attr.data-size]': 'size()',
  },
})
export class HlmCard {
  private readonly _defaultConfig = injectHlmCardConfig();
  public readonly size = input<HlmCardConfig['size']>(this._defaultConfig.size);

  constructor() {
    classes(
      () =>
        // The bottom padding is NOT dropped: `py-(--card-spacing)` is the
        // card's padding, and a card whose last line has a taller line box
        // than the Latin one (Arabic, a larger font) had its bottom clipped
        // by `overflow-hidden` — the "Total" card on the order page lost the
        // bottom of its amount. A card WITH a footer keeps the flush bottom
        // (`has-data-[slot=card-footer]:pb-0`); a card without one has the
        // same padding on every side.
        'ring-foreground/10 bg-card text-card-foreground gap-(--card-spacing) overflow-hidden rounded-[var(--radius-card)] py-(--card-spacing) text-sm ring-1 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-[var(--radius-card)] *:[img:last-child]:rounded-b-[var(--radius-card)] group/card flex flex-col',
    );
  }
}
