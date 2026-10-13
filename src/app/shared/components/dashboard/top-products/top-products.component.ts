import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmAvatar } from '@spartan-ng/helm/avatar';

import { TranslocoPipe } from '@jsverse/transloco';
@Component({
  selector: 'app-top-products',
  standalone: true,
  imports: [CommonModule, HlmAvatar, TranslocoPipe,
  ],
  templateUrl: './top-products.component.html',
})
export class TopProductsComponent {
  @Input() products: {
    name: string;
    quantitySold: number;
    price: number;
    imageUrl?: string | null;
  }[] = [];
}