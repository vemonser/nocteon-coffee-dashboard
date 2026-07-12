import { Component,  signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HlmAvatarImports } from '@spartan-ng/helm/avatar';

import { HlmBadgeImports } from '@spartan-ng/helm/badge';

@Component({
  selector: 'app-recent-orders',
  standalone: true,
  imports: [CommonModule, HlmBadgeImports, HlmAvatarImports],
  templateUrl: './recent-orders.component.html',
})
export class RecentOrdersComponent {
  // هنا ممكن تعمل service منفصل للـ live orders
  // دلوقتي هنستخدم static data أو نعمل mock

  orders = signal([
    {
      id: '#ORD-1045',
      customer: 'Alex Morgan',
      date: 'Jul 15, 2025',
      amount: 128.0,
      status: 'Paid',
      avatar: '',
    },
    {
      id: '#ORD-1044',
      customer: 'Sarah Johnson',
      date: 'Jul 15, 2025',
      amount: 96.5,
      status: 'Paid',
      avatar: '',
    },
    {
      id: '#ORD-1043',
      customer: 'Michael Brown',
      date: 'Jul 14, 2025',
      amount: 75.2,
      status: 'Processing',
      avatar: '',
    },
    {
      id: '#ORD-1042',
      customer: 'Emma Davis',
      date: 'Jul 14, 2025',
      amount: 180.0,
      status: 'Shipped',
      avatar: '',
    },
    {
      id: '#ORD-1041',
      customer: 'James Wilson',
      date: 'Jul 13, 2025',
      amount: 65.8,
      status: 'Paid',
      avatar: '',
    },
  ]);

  getStatusVariant(
    status: string,
  ): 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' {
    const map: Record<
      string,
      'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
    > = {
      Paid: 'default',
      Processing: 'secondary',
      Shipped: 'outline',
      Cancelled: 'destructive',
      Pending: 'ghost',
    };

    return map[status] || 'secondary';
  }
}
