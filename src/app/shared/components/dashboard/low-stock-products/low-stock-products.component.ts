import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePackage, lucideCheckCircle, lucideChevronRight } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { LowStockProductDto } from '../../../../features/dashboard/model/DashboardOverviewDto';

@Component({
  selector: 'app-low-stock-products',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIcon, HlmButtonImports, TranslocoPipe],
  providers: [provideIcons({ lucidePackage, lucideCheckCircle, lucideChevronRight })],
  templateUrl: './low-stock-products.component.html',
})
export class LowStockProductsComponent {
  @Input() products: LowStockProductDto[] = [];

  private router = inject(Router);

  /**
   * The reorder point, when the backend sent one.
   *
   * A product with no threshold still belongs in the list (the API chose to
   * flag it), but there is no line to measure it against — so the bar is not
   * drawn rather than drawn against a made-up number.
   */
  threshold(product: LowStockProductDto): number | null {
    const value = product.reorderThreshold;
    return typeof value === 'number' && value > 0 ? value : null;
  }

  /** The stock left as a share of the reorder point (full = at the line). */
  stockShare(product: LowStockProductDto): number {
    const threshold = this.threshold(product);
    if (!threshold) return 0;
    const share = (product.stockQuantity / threshold) * 100;
    return Math.max(0, Math.min(100, Math.round(share)));
  }

  /** Out of stock is destructive; anything else is the warning tone. */
  severityColor(product: LowStockProductDto): string {
    return product.stockQuantity <= 0 ? 'var(--destructive)' : 'var(--warning)';
  }

  /** The fill and ink of the severity pill. */
  severityTone(product: LowStockProductDto): string {
    return product.stockQuantity <= 0
      ? 'bg-destructive-soft text-destructive-text'
      : 'bg-warning-soft text-warning';
  }

  goTo(product: LowStockProductDto): void {
    this.router.navigate(['/dashboard/products', product.slug, 'edit']);
  }
}