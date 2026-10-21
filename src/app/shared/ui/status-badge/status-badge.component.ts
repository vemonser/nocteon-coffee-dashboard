import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  lucideAlertCircle,
  lucideCheckCircle,
  lucideInfo,
  lucidePackage,
  lucideTruck,
  lucideXCircle,
  lucideRotateCcw,
  lucideClock,
} from '@ng-icons/lucide';

export type StatusKind =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed'
  | 'refunded'
  | 'enabled'
  | 'disabled';

/**
 * Centralized status badge mapping.
 *
 * Color mapping follows design.md §4:
 * - Pending = warning (amber) + icon
 * - Paid/Delivered = success (green) + icon
 * - Processing = info (blue) + icon
 * - Shipped = neutral (muted) + icon
 * - Cancelled/Failed = destructive-soft (red) + icon
 * - Refunded = muted (gray) + icon
 * - Enabled = success + icon
 * - Disabled = muted + icon
 *
 * Primary copper is NEVER used for status colors.
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule, HlmBadgeImports, NgIcon, TranslocoPipe],
  providers: [
    provideIcons({
      lucideAlertCircle,
      lucideCheckCircle,
      lucideInfo,
      lucidePackage,
      lucideTruck,
      lucideXCircle,
      lucideRotateCcw,
      lucideClock,
    }),
  ],
  template: `
    <hlm-badge [class]="badgeClass()" class="gap-1.5 flex items-center">
      @if (icon()) {
        <ng-icon [name]="icon()" class="size-3" />
      }
      <span>{{ label() | transloco }}</span>
    </hlm-badge>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<StatusKind>();
  readonly customLabel = input<string>();

  protected readonly label = computed(() => {
    if (this.customLabel()) return this.customLabel();
    const labels: Record<StatusKind, string> = {
      pending: 'common.statuses.pending',
      paid: 'common.statuses.paid',
      processing: 'common.statuses.processing',
      shipped: 'common.statuses.shipped',
      delivered: 'common.statuses.delivered',
      cancelled: 'common.statuses.cancelled',
      failed: 'common.statuses.failed',
      refunded: 'common.statuses.refunded',
      enabled: 'common.statuses.enabled',
      disabled: 'common.statuses.disabled',
    };
    return labels[this.status()];
  });

  protected readonly icon = computed(() => {
    const icons: Record<StatusKind, string> = {
      pending: 'lucideClock',
      paid: 'lucideCheckCircle',
      processing: 'lucidePackage',
      shipped: 'lucideTruck',
      delivered: 'lucideCheckCircle',
      cancelled: 'lucideXCircle',
      failed: 'lucideAlertCircle',
      refunded: 'lucideRotateCcw',
      enabled: 'lucideCheckCircle',
      disabled: 'lucideXCircle',
    };
    return icons[this.status()];
  });

  protected readonly badgeClass = computed(() => {
    const base = 'gap-1.5 flex items-center';
    const variants: Record<StatusKind, string> = {
      pending: 'bg-warning-soft text-warning',
      paid: 'bg-success-soft text-success',
      processing: 'bg-info-soft text-info',
      shipped: 'bg-muted text-muted-foreground',
      delivered: 'bg-success-soft text-success',
      cancelled: 'bg-destructive-soft text-destructive-text',
      failed: 'bg-destructive-soft text-destructive-text',
      refunded: 'bg-muted text-muted-foreground',
      enabled: 'bg-success-soft text-success',
      disabled: 'bg-muted text-muted-foreground',
    };
    return `${base} ${variants[this.status()]}`;
  });
}