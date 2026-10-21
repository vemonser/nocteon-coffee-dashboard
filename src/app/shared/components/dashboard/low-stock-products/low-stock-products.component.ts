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

  goTo(product: LowStockProductDto): void {
    this.router.navigate(['/dashboard/products', product.slug, 'edit']);
  }
}