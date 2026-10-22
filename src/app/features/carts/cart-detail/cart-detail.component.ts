import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CartService } from '../services/cart.service';
import { CartResponse } from '../models/cart.model';
import { HlmCardImports, HlmCardContent } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucidePackage, lucideUser, lucideShoppingCart, lucideDollarSign, lucideClock, lucideMail } from '@ng-icons/lucide';
import { UserAvatarComponent } from '../../../shared/ui/user-avatar/user-avatar.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { StatusBadgeComponent, StatusKind } from '../../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-cart-detail',
  standalone: true,
  imports: [
    LocalizedDateComponent,
    CommonModule,
    HlmCardImports,
    HlmCardContent,
    HlmButtonImports,
    HlmBadgeImports,
    NgIcon,
    TranslocoPipe,
    MoneyPipe,
    UserAvatarComponent,
    StatusBadgeComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowLeft,
      lucidePackage,
      lucideUser,
      lucideShoppingCart,
      lucideDollarSign,
      lucideClock,
      lucideMail,
    }),
  ],
  templateUrl: './cart-detail.component.html',
})
export class CartDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cartService = inject(CartService);

  cart = signal<CartResponse | null>(null);
  loading = signal(true);

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadCart(id);
  }

  private loadCart(id: number): void {
    this.loading.set(true);
    this.cartService.getById(id).subscribe({
      next: (res) => {
        this.cart.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/carts']);
  }

  cartStatusKind(cart: CartResponse): StatusKind {
    switch (cart.status) {
      case 'ACTIVE': return 'active';
      case 'ABANDONED': return 'abandoned';
      case 'CONVERTED': return 'converted';
      default: return 'active';
    }
  }
}