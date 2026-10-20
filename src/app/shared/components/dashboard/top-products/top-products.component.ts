import { Component, Input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '../../../pipes/plural.pipe';
import { LanguageService } from '../../../../core/i18n/language.service';

/**
 * The best sellers.
 *
 * It shows UNITS with a share bar, not the unit price. The list price is the
 * product's LOWEST variant price and is not what the customer paid, so
 * putting it next to "8 sold" implied a number that was never true.
 *
 * The API does not return per-product revenue (`topSellingProducts` carries
 * `price` — the lowest variant price — and `quantitySold`), so units are
 * what can be shown truthfully. The missing contract is listed in
 * `evidence/phase4/measurements.json`.
 */
@Component({
  selector: 'app-top-products',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoPipe, PluralPipe],
  templateUrl: './top-products.component.html',
  styleUrl: './top-products.component.css',
})
export class TopProductsComponent {
  @Input() products: {
    name: string;
    slug?: string;
    quantitySold: number;
    price: number;
    imageUrl?: string | null;
  }[] = [];

  private readonly language = inject(LanguageService);

  /** The most units sold — the share bars are scaled to it. */
  readonly max = computed(() =>
    this.products.reduce((max, p) => Math.max(max, p.quantitySold || 0), 0),
  );

  /** The share of the top product, as a percentage. */
  share(quantity: number): number {
    const max = this.max();
    if (!max) return 0;
    return Math.max(2, Math.round((quantity / max) * 1000) / 10);
  }
}
