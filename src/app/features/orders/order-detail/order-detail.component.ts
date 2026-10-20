import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../services/order.service';
import { OrderResponse, OrderStatus } from '../models/order.model';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucidePackage, lucideUser, lucideCreditCard, lucideTruck, lucideDollarSign, lucideClock } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { NotifyService } from '../../../core/notify/notify.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, HlmCardImports, HlmButtonImports, HlmBadgeImports, HlmSelectImports, NgIcon, TranslocoPipe, MoneyPipe],
  providers: [provideIcons({ lucideArrowLeft, lucidePackage, lucideUser, lucideCreditCard, lucideTruck, lucideDollarSign, lucideClock })],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderService = inject(OrderService);
  private notify = inject(NotifyService);

  order = signal<OrderResponse | null>(null);
  loading = signal(true);
  updating = signal(false);
  error = signal<string | null>(null);

  statusOptions: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadOrder(id);
  }

  private loadOrder(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.orderService.getById(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Could not load order');
      },
    });
  }

  retry(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadOrder(id);
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'bg-warning-soft text-warning';
      case 'CONFIRMED': return 'bg-info-soft text-info';
      case 'PROCESSING': return 'bg-info-soft text-info';
      case 'SHIPPED': return 'bg-info-soft text-info';
      case 'DELIVERED': return 'bg-success-soft text-success';
      case 'CANCELLED': return 'bg-destructive-soft text-destructive-text';
      case 'REFUNDED': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  }

  updateStatus(newStatus: OrderStatus | null | undefined): void {
    if (!newStatus) return;
    const order = this.order();
    if (!order) return;
    if (newStatus === 'CANCELLED') {
      if (!confirm(`Change order status to ${newStatus}? This may be irreversible.`)) return;
    }
    this.updating.set(true);
    this.orderService.updateStatus(order.id, newStatus).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.updating.set(false);
        this.notify.success('notify.statusUpdated', 'Status updated');
      },
      error: (err) => {
        this.updating.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not update order status');
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/orders']);
  }
}