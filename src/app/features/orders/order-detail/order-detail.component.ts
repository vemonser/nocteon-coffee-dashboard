import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../services/order.service';
import { OrderResponse, OrderStatus } from '../models/order.model';
import { HlmCardImports, HlmCardContent } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucidePackage, lucideUser, lucideCreditCard, lucideTruck, lucideDollarSign, lucideClock } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, HlmCardImports, HlmCardContent, HlmButtonImports, HlmBadgeImports, HlmSelectImports, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideArrowLeft, lucidePackage, lucideUser, lucideCreditCard, lucideTruck, lucideDollarSign, lucideClock })],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);

  order = signal<OrderResponse | null>(null);
  loading = signal(true);
  updating = signal(false);

  statusOptions: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadOrder(id);
  }

  private loadOrder(id: number): void {
    this.loading.set(true);
    this.orderService.getById(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'PROCESSING': return 'bg-purple-100 text-purple-800';
      case 'SHIPPED': return 'bg-indigo-100 text-indigo-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'REFUNDED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  updateStatus(newStatus: OrderStatus | null | undefined): void {
    if (!newStatus) return;
    const order = this.order();
    if (!order) return;
    this.updating.set(true);
    this.orderService.updateStatus(order.id, newStatus).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.updating.set(false);
      },
      error: () => this.updating.set(false),
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/orders']);
  }
}