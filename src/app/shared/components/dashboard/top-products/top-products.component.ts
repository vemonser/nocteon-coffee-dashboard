import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideTrendingUp, lucideTrendingDown } from '@ng-icons/lucide';
import { HlmAvatar } from '@spartan-ng/helm/avatar';

@Component({
  selector: 'app-top-products',
  standalone: true,
  imports: [CommonModule, HlmAvatar, NgIcon],
  providers: [provideIcons({ lucideTrendingUp, lucideTrendingDown })],
  templateUrl: './top-products.component.html',
})
export class TopProductsComponent {
  @Input() products: {
    name: string;
    sold: number;
    revenue: number;
    imageUrl?: string;
    growth?: number;
  }[] = [];
}
